import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../auth/useAuth';
import { apiFetch, normalizeImageUrl, formatRaceTime, TOKEN_STORAGE_KEY } from '../api';
import JigsawPuzzle from '../components/JigsawPuzzle';
import { useNavigate } from 'react-router-dom';
import {
  Trophy, ShieldAlert, ChevronRight, PlusCircle, CheckCircle, Play,
  Move, RotateCw, Puzzle, Smartphone, X, ArrowLeft
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CATALOG_GAMES } from '../config/catalogGames';
import { ArenaHero, ArenaSteps, ContestCard } from '../components/arena/ArenaParts';
import { contestImage, gameName } from '../components/arena/arenaUtils';

// Resolves once the puzzle image has loaded, with its portrait/landscape
// orientation — needed BEFORE /api/contest/start now, since the server
// decides and stores the board's grid dimensions from it (see
// contestController.js#startAttemptHandler). Browser image cache makes this
// effectively instant in practice: the same URL is already rendered on the
// "ready to start" screen the player is looking at when they press Start.
function detectImageOrientation(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img.naturalHeight > img.naturalWidth);
    img.onerror = () => reject(new Error('image-load-failed'));
    img.src = url;
  });
}

export default function SkillZone() {
  const { user, wallet, refreshWallet } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Lobby category filter — 'all' or a CATALOG_GAMES slug
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Admin Upload form state
  const [isAdminFormOpen, setIsAdminFormOpen] = useState(false);
  const [newContestTitle, setNewContestTitle] = useState('');
  const [newContestDesc, setNewContestDesc] = useState('');
  const [newContestCat, setNewContestCat] = useState('lego');
  const [newContestVal, setNewContestVal] = useState(100);
  const [newContestCost, setNewContestCost] = useState(10);
  const [newContestCond, setNewContestCond] = useState('New in Box');
  const [newContestGrading, setNewContestGrading] = useState('Ungraded');
  const [newContestSlots, setNewContestSlots] = useState(5);
  const [newContestFile, setNewContestFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState('');

  // Reference-item price lookup — searches the real catalog APIs (LEGO/Rebrickable,
  // TCGs via Scryfall/PokemonTCG/etc.) to suggest a market value, slot count, and
  // entry ticket cost consistent with real average sale prices, instead of the admin
  // guessing numbers blind.
  const [refQuery, setRefQuery] = useState('');
  const [refResults, setRefResults] = useState([]);
  const [refSearching, setRefSearching] = useState(false);
  const [refSelected, setRefSelected] = useState(null); // { name, imgUrl, priceEur: number|null }

  // Catalog Data Lists
  const [contests, setContests] = useState([]);
  const [leaderboards, setLeaderboards] = useState({}); // key: contestId -> []
  
  // Game Session States
  const [confirmingContest, setConfirmingContest] = useState(null); // contest pending purchase confirmation (table screen)
  const [reservedContest, setReservedContest] = useState(null); // slot bought, waiting for the player to press Start
  const [playingContest, setPlayingContest] = useState(null); // contest details
  const [attemptToken, setAttemptToken] = useState(null); // anti-cheat start token
  const [boardIsPortrait, setBoardIsPortrait] = useState(false); // decided pre-/start, passed to JigsawPuzzle as a prop
  const [gameResult, setGameResult] = useState(null); // leaderboard status after submission
  const [readyBannerDismissed, setReadyBannerDismissed] = useState(false); // title/instructions banner on the in-fullscreen ready panel

  // Detected as soon as a slot is reserved (not only at Start, as before) so
  // the "ready to start" screen can tell the player to rotate their phone
  // BEFORE they commit to starting — a landscape puzzle image squeezed into
  // a portrait phone screen was the real cause of pieces being too small to
  // tap/drag accurately, not the tap-vs-drag logic itself.
  const [pendingImageIsPortrait, setPendingImageIsPortrait] = useState(null);
  // The PHONE's current orientation (not the image's) — reactive, so the
  // rotate-prompt banner disappears the moment the player actually rotates.
  const [deviceIsPortrait, setDeviceIsPortrait] = useState(
    typeof window !== 'undefined' ? window.innerHeight >= window.innerWidth : true
  );

  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)');
    const update = () => setDeviceIsPortrait(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!reservedContest) {
      setPendingImageIsPortrait(null);
      return;
    }
    let cancelled = false;
    detectImageOrientation(normalizeImageUrl(reservedContest.imageUrl))
      .then((isPortrait) => { if (!cancelled) setPendingImageIsPortrait(isPortrait); })
      .catch(() => { if (!cancelled) setPendingImageIsPortrait(null); });
    return () => { cancelled = true; };
  }, [reservedContest]);

  // The play screen takes over the whole viewport (see the fixed inset-0
  // wrapper below) — lock background scroll while it's up, and drop out of
  // native fullscreen (if requestFullscreen above actually took) once play
  // ends, however it ends (finished, abandoned, or the tab is left).
  useEffect(() => {
    if (!playingContest) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    };
  }, [playingContest]);

  // Alerts & Messages
  const [sysAlert, setSysAlert] = useState(null);
  const [sysSuccess, setSysSuccess] = useState(null);

  // WebSockets Ref
  const wsRef = useRef(null);

  // Fetch all initial metadata
  const fetchCatalogData = async () => {
    try {
      const contData = await apiFetch('/api/contest/list');
      if (contData && contData.contests) setContests(contData.contests);
    } catch (err) {
      console.error('Error loading catalogs:', err);
    }
  };

  // Re-fetch leaderboard for a contest
  const fetchLeaderboard = async (contestId) => {
    try {
      const data = await apiFetch(`/api/contest/leaderboard/${contestId}`);
      if (data && data.leaderboard) {
        setLeaderboards(prev => ({
          ...prev,
          [contestId]: data.leaderboard
        }));
      }
    } catch (err) {
      console.error('Error loading leaderboard:', err);
    }
  };

  // Initialize WebSockets
  const connectWebSocket = () => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Always target the backend's port (3000) on whatever host served this page —
    // using window.location.host as-is would point at the Vite dev port instead
    // of the backend when accessed from a LAN IP (e.g. viewing the site from a phone).
    const wsHost = `${window.location.hostname}:3000`;
    const wsUrl = `${wsProtocol}//${wsHost}`;

    console.log(`Connecting to WebSocket hub: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('📡 WS Received event:', message);

        if (message.type === 'SLOT_FILLED') {
          const { contestId, filledSlots, contestStatus } = message.payload;
          setContests(prev => prev.map(con => {
            if (con.id === contestId) {
              return { ...con, filledSlots, status: contestStatus };
            }
            return con;
          }));
          fetchLeaderboard(contestId);
        }

        if (message.type === 'CONTEST_CREATED') {
          const newContest = message.payload;
          setContests(prev => {
            if (prev.some(c => c.id === newContest.id)) return prev;
            return [newContest, ...prev];
          });
          triggerSystemSuccess(t('skill_zone.alerts.new_contest', { title: newContest.title }));
        }
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };

    ws.onclose = () => {
      console.log('WS connection lost. Retrying in 5 seconds...');
      setTimeout(connectWebSocket, 5000);
    };
  };

  useEffect(() => {
    fetchCatalogData();
    connectWebSocket();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Poll catalogs for countdown timers
  useEffect(() => {
    const timer = setInterval(() => {
      fetchCatalogData();
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Sync leaderboard when contests load
  useEffect(() => {
    contests.forEach(c => {
      if (!leaderboards[c.id]) {
        fetchLeaderboard(c.id);
      }
    });
  }, [contests]);

  const triggerSystemAlert = (text) => {
    setSysAlert(text);
    setTimeout(() => setSysAlert(null), 4000);
  };

  const triggerSystemSuccess = (text) => {
    setSysSuccess(text);
    setTimeout(() => setSysSuccess(null), 4000);
  };

  // Step 1: clicking a contest card/button opens the confirmation table instead of
  // charging credits immediately — no purchase happens until the user explicitly confirms.
  const openConfirm = (con) => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (con.status !== 'open') {
      triggerSystemAlert(t('skill_zone.alerts.contest_closed'));
      return;
    }
    setConfirmingContest(con);
  };

  const cancelConfirm = () => setConfirmingContest(null);

  // Step 2: user confirms on the table — this is the only place that actually spends
  // credits. On success the slot is reserved but the attempt/timer has NOT started yet.
  const handleConfirmPurchase = async () => {
    const con = confirmingContest;
    if (!con) return;

    try {
      setUploadProgress(t('skill_zone.alerts.acquiring_ticket'));
      const buyData = await apiFetch('/api/contest/buy-slot', {
        method: 'POST',
        body: { contestId: con.id }
      });
      refreshWallet();
      fetchCatalogData();
      fetchLeaderboard(con.id);
      triggerSystemSuccess(buyData.message);

      setConfirmingContest(null);
      setReservedContest(con);
      setUploadProgress('');
    } catch (err) {
      setUploadProgress('');
      triggerSystemAlert(err.message || t('skill_zone.alerts.buy_slot_failed'));
    }
  };

  // The slot is already paid for at this point — backing out doesn't refund it, it just
  // leaves the reserved attempt unstarted (still resumable later since /start picks up
  // the caller's most recent unstarted participant row).
  const cancelReserved = () => {
    setReservedContest(null);
    fetchCatalogData();
  };

  // Step 3a: "Continue" press from the reserved screen — just enters the
  // full-screen game view (and best-effort requests native fullscreen,
  // which needs to happen inside a real click handler like this one to be
  // allowed at all). Does NOT call /api/contest/start yet: the player still
  // needs room to rotate their phone and read the how-to-play banner
  // without any clock running, so that now happens on the ready panel
  // INSIDE the full-screen view (attemptToken stays null until its own
  // green Start button — see handleBeginSolving below).
  const handleStartAttempt = async () => {
    const con = reservedContest;
    if (!con) return;

    // Already resolved by the effect above in the common case — only
    // re-detect here if the player clicked before it finished.
    let isPortrait = pendingImageIsPortrait;
    if (isPortrait === null) {
      try {
        isPortrait = await detectImageOrientation(normalizeImageUrl(con.imageUrl));
      } catch {
        triggerSystemAlert(t('skill_zone.alerts.image_load_error'));
        return; // don't spend the attempt on a puzzle that can't even load
      }
    }

    setReservedContest(null);
    setPlayingContest(con);
    setBoardIsPortrait(isPortrait);
    setAttemptToken(null);
    setGameResult(null);
    setReadyBannerDismissed(false);

    // Best-effort true fullscreen (hides the browser's own address bar on
    // browsers that support it) — never blocks entering the game view if
    // it fails or isn't available; the fixed-position takeover is what
    // actually guarantees the app-like full-screen layout either way.
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      // Ignored — plenty of legitimate reasons this can fail (iOS Safari,
      // no user-activation in this exact call stack, already fullscreen…).
    }
  };

  // Step 3b: the actual "Start" press, from the ready panel INSIDE the
  // full-screen view (after any rotating/reading is done) — this is now
  // the moment the server records started_at and mints the anti-cheat
  // attempt token, so the race clock and the official server time begin
  // together, excluding not just the purchase/confirmation screens but
  // also the fullscreen-transition/rotate-your-phone moment.
  const handleBeginSolving = async () => {
    if (!playingContest) return;
    try {
      const startData = await apiFetch('/api/contest/start', {
        method: 'POST',
        body: { contestId: playingContest.id, isPortrait: boardIsPortrait }
      });
      fetchCatalogData();
      fetchLeaderboard(playingContest.id);
      setAttemptToken(startData.attemptToken);
    } catch (err) {
      triggerSystemAlert(err.message || t('skill_zone.alerts.start_error'));
    }
  };

  // Fired by JigsawPuzzle every time the player snaps a piece into place —
  // the server independently re-verifies the position (see
  // contestController.js#lockPieceHandler) before counting it. Tracked in
  // pendingLockPiecesRef while in flight so handleCompleteAttempt can wait
  // for stragglers instead of racing ahead of a slow mobile connection —
  // completing the instant the LAST piece snaps client-side used to call
  // /complete before an earlier piece's confirmation had necessarily
  // landed yet, which the server then correctly (but confusingly, from the
  // player's side) reported as an incomplete/void attempt despite the
  // puzzle visibly being finished.
  const pendingLockPiecesRef = useRef(new Set());

  const handlePieceLocked = async ({ pieceId, x, y, rotation }) => {
    pendingLockPiecesRef.current.add(pieceId);
    const maxAttempts = 5;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        await apiFetch('/api/contest/lock-piece', {
          method: 'POST',
          body: { contestId: playingContest?.id, attemptToken, pieceId, x, y, rotation }
        });
        pendingLockPiecesRef.current.delete(pieceId);
        return;
      } catch (err) {
        if (attempt === maxAttempts - 1) {
          console.warn('Piece lock did not reach the server after retries:', pieceId, err.message);
        } else {
          await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1))); // 300/600/900/1200ms backoff
        }
      }
    }
  };

  // Complete attempt handler
  const handleCompleteAttempt = async ({ contestId, attemptToken, blurCount, totalBlurTimeMs }) => {
    // Give any still-in-flight piece confirmations a last chance to land —
    // see pendingLockPiecesRef comment above.
    const waitDeadline = Date.now() + 4000;
    while (pendingLockPiecesRef.current.size > 0 && Date.now() < waitDeadline) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    try {
      const data = await apiFetch('/api/contest/complete', {
        method: 'POST',
        body: {
          contestId,
          attemptToken,
          blurCount,
          totalBlurTimeMs
        }
      });

      setGameResult(data);
      refreshWallet();
      fetchCatalogData();
      fetchLeaderboard(contestId);
    } catch (err) {
      triggerSystemAlert(t('skill_zone.alerts.submit_score_error'));
    }
  };

  // Admin jigsaw creation upload handler
  const handleCreateContestSubmit = async (e) => {
    e.preventDefault();
    if (!newContestTitle) {
      triggerSystemAlert(t('skill_zone.alerts.title_required'));
      return;
    }
    if (!newContestFile) {
      triggerSystemAlert(t('skill_zone.alerts.image_required'));
      return;
    }

    setUploadProgress(t('skill_zone.alerts.uploading'));
    
    try {
      const formData = new FormData();
      formData.append('title', newContestTitle);
      formData.append('description', newContestDesc);
      formData.append('category', newContestCat);
      formData.append('marketValue', newContestVal);
      formData.append('slotCostCredits', newContestCost);
      formData.append('condition', newContestCond);
      formData.append('gradingInfo', newContestGrading);
      formData.append('totalSlots', newContestSlots);
      formData.append('image', newContestFile);

      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      const response = await fetch('/api/admin/upload-puzzle-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || t('skill_zone.alerts.create_failed'));
      }

      const newContestObj = {
        id: data.contestId,
        productId: `p_${data.contestId}`,
        title: newContestTitle,
        imageUrl: data.imageUrl,
        category: newContestCat,
        marketValue: parseFloat(newContestVal),
        condition: newContestCond,
        gradingInfo: newContestGrading,
        totalSlots: parseInt(newContestSlots, 10),
        filledSlots: 0,
        slotCostCredits: parseFloat(newContestCost),
        status: 'open',
        winnerId: null
      };

      setContests(prev => {
        if (prev.some(c => c.id === newContestObj.id)) return prev;
        return [newContestObj, ...prev];
      });

      triggerSystemSuccess(t('skill_zone.alerts.contest_created'));
      setNewContestTitle('');
      setNewContestDesc('');
      setNewContestVal(100);
      setNewContestCost(10);
      setNewContestCond('New in Box');
      setNewContestGrading('Ungraded');
      setNewContestSlots(5);
      setNewContestFile(null);
      setUploadProgress('');
      setIsAdminFormOpen(false);
      setRefQuery('');
      setRefResults([]);
      setRefSelected(null);

      // Refresh catalog data
      fetchCatalogData();
    } catch (err) {
      setUploadProgress('');
      triggerSystemAlert(err.message || t('skill_zone.alerts.upload_error'));
    }
  };

  // Clear a stale reference selection when the category changes, since a price/image
  // tied to the previous category no longer describes the newly selected division.
  useEffect(() => {
    setRefSelected(null);
    setRefQuery('');
    setRefResults([]);
  }, [newContestCat]);

  // Debounced reference-item search against the real catalog APIs, scoped to the
  // currently selected category (LEGO uses /api/catalog/search, every other game
  // uses its dedicated /api/catalog/<game>/search endpoint from CATALOG_GAMES).
  useEffect(() => {
    if (!isAdminFormOpen || refQuery.trim().length < 2) {
      setRefResults([]);
      return;
    }

    const game = CATALOG_GAMES.find(g => g.slug === newContestCat);
    const searchPath = newContestCat === 'lego'
      ? `/api/catalog/search?q=${encodeURIComponent(refQuery)}`
      : `${game?.apiBase}/search?q=${encodeURIComponent(refQuery)}`;

    const timer = setTimeout(async () => {
      setRefSearching(true);
      try {
        const results = await apiFetch(searchPath);
        setRefResults(Array.isArray(results) ? results.slice(0, 8) : []);
      } catch {
        setRefResults([]);
      } finally {
        setRefSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [refQuery, newContestCat, isAdminFormOpen]);

  // Derives a suggested slot count and entry ticket cost from a market value: aims
  // for total entry fees around ~50% of the item's value (the rest is the platform's
  // margin, the winner takes the item), scaling slot count up for pricier items so
  // the per-ticket cost stays in a reasonable credits range.
  const suggestSlotsAndCost = (marketValue) => {
    const totalSlots = Math.min(50, Math.max(3, Math.round(Math.sqrt(marketValue) * 1.4)));
    const slotCostCredits = Math.max(1, Math.round((marketValue * 0.5) / totalSlots));
    return { totalSlots, slotCostCredits };
  };

  const applyPriceSuggestion = (marketValue) => {
    const val = Math.round(marketValue * 100) / 100;
    const { totalSlots, slotCostCredits } = suggestSlotsAndCost(val);
    setNewContestVal(val);
    setNewContestSlots(totalSlots);
    setNewContestCost(slotCostCredits);
  };

  const handleSelectRefItem = async (item) => {
    setRefResults([]);
    setRefQuery(item.name);
    setNewContestTitle(item.name);

    if (newContestCat === 'lego') {
      setRefSelected({ name: item.name, imgUrl: item.img_url, priceEur: null });
      try {
        const detail = await apiFetch(`/api/catalog/${item.set_num}`);
        const marketValue = detail?.pricing?.marketValue;
        if (marketValue) {
          applyPriceSuggestion(marketValue);
          setRefSelected({ name: item.name, imgUrl: item.img_url, priceEur: marketValue });
        }
      } catch {
        // No pricing available for this set — admin sets value manually.
      }
    } else {
      const priceEur = item.details?.priceEur ? parseFloat(item.details.priceEur) : null;
      if (priceEur) applyPriceSuggestion(priceEur);
      setRefSelected({ name: item.name, imgUrl: item.img_url, priceEur });
    }
  };

  // Lobby presentation: open contests first, fullest first, so the most urgent tables lead.
  const fillRatio = (c) => (c.totalSlots ? c.filledSlots / c.totalSlots : 0);
  const lobbyContests = contests
    .filter((con) => categoryFilter === 'all' || con.category === categoryFilter)
    .sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || fillRatio(b) - fillRatio(a));
  const spotlight = [...contests].filter((c) => c.status === 'open').sort((a, b) => fillRatio(b) - fillRatio(a))[0] || null;

  const stageButton = 'inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-sm font-black transition-transform';

  return (
    <div className="lx-page">
      {/* Global Alerts */}
      {sysAlert && (
        <div role="alert" className="fixed right-4 top-20 z-[120] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl border border-[#ff5a36]/50 bg-[#1a0c0a]/95 px-4 py-3 text-sm font-bold text-white shadow-2xl backdrop-blur-xl">
          <ShieldAlert className="h-5 w-5 shrink-0 text-[#ff5a36]" />
          <span>{sysAlert}</span>
        </div>
      )}
      {sysSuccess && (
        <div role="status" className="fixed right-4 top-20 z-[120] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl border border-[#22d3ee]/50 bg-[#071a1f]/95 px-4 py-3 text-sm font-bold text-white shadow-2xl backdrop-blur-xl">
          <CheckCircle className="h-5 w-5 shrink-0 text-[#22d3ee]" />
          <span>{sysSuccess}</span>
        </div>
      )}

      {/* Slot Purchase Confirmation — no credits move until this is confirmed */}
      {confirmingContest && (
        <section className="lx-bleed relative overflow-hidden">
          <div className="pointer-events-none absolute left-1/2 top-24 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[#8b5cf6]/20 blur-[130px]" aria-hidden="true" />
          <div className="relative mx-auto max-w-[1000px] px-5 pb-20 pt-28 md:px-10 md:pt-36">
            <button type="button" onClick={cancelConfirm} className="-my-2 inline-flex items-center gap-2 py-2 text-sm font-bold text-white/60 hover:text-white">
              <ArrowLeft size={16} /> {t('skill_zone.confirm.cancel_reserved_button')}
            </button>
            <h1 className="mt-5 text-[clamp(2.2rem,6vw,4rem)] font-black leading-[0.92] tracking-[-0.045em] text-white">
              {t('skill_zone.confirm.heading')}
            </h1>

            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-[0.9fr_1.1fr]">
              <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-black">
                <img src={contestImage(confirmingContest, 800)} alt={confirmingContest.title} className="aspect-square h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute inset-x-5 bottom-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-white/60">{gameName(confirmingContest.category)}</p>
                  <p className="mt-1 text-2xl font-black leading-tight text-white">{confirmingContest.title}</p>
                  <p className="mt-1 text-xs text-white/60">{confirmingContest.gradingInfo || t('skill_zone.lobby.condition_fallback')}</p>
                </div>
              </div>

              <div className="rounded-[32px] border border-white/10 bg-[#100d18] p-5 md:p-7">
                <dl className="divide-y divide-white/10 text-sm">
                  {[
                    [t('skill_zone.confirm.table_category'), gameName(confirmingContest.category), 'text-white'],
                    [t('skill_zone.confirm.table_market_value'), `${confirmingContest.marketValue} CR`, 'text-white'],
                    [t('skill_zone.confirm.table_slots_left'), `${confirmingContest.totalSlots - confirmingContest.filledSlots} / ${confirmingContest.totalSlots}`, 'text-white'],
                    [t('skill_zone.confirm.table_slot_cost'), `${confirmingContest.slotCostCredits} CR`, 'text-[#22d3ee]'],
                    [t('skill_zone.confirm.table_balance_current'), `${wallet.balanceCredits} CR`, 'text-white'],
                  ].map(([label, value, color]) => (
                    <div key={label} className="flex items-center justify-between gap-4 py-3">
                      <dt className="text-white/55">{label}</dt>
                      <dd className={`font-mono font-black ${color}`}>{value}</dd>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-4 py-3">
                    <dt className="font-bold text-white">{t('skill_zone.confirm.table_balance_after')}</dt>
                    <dd className={`font-mono text-lg font-black ${wallet.balanceCredits - confirmingContest.slotCostCredits < 0 ? 'text-[#ff5a36]' : 'text-[#c6ff3d]'}`}>
                      {(wallet.balanceCredits - confirmingContest.slotCostCredits).toFixed(2)} CR
                    </dd>
                  </div>
                </dl>

                {wallet.balanceCredits < confirmingContest.slotCostCredits ? (
                  <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-[#ff5a36]/40 bg-[#ff5a36]/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                    {/* Top-up crediti (Stripe) temporaneamente disattivato — nessun CTA di ricarica qui */}
                    <p className="text-sm text-white/80">{t('skill_zone.confirm.insufficient_balance')}</p>
                  </div>
                ) : (
                  <p className="mt-5 text-sm leading-relaxed text-white/55">{t('skill_zone.confirm.warning')}</p>
                )}

                {uploadProgress && (
                  <p className="lx-ping-soft mt-4 rounded-xl bg-[#8b5cf6]/15 px-4 py-3 text-center text-sm font-bold text-white">{uploadProgress}</p>
                )}

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
                  <button type="button" onClick={cancelConfirm} className={`${stageButton} flex-1 border border-white/15 text-white hover:border-white/40`}>
                    {t('skill_zone.confirm.cancel_button')}
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmPurchase}
                    disabled={wallet.balanceCredits < confirmingContest.slotCostCredits || !!uploadProgress}
                    className={`${stageButton} flex-[1.4] bg-gradient-to-r from-[#8b5cf6] to-[#22d3ee] text-white enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    {t('skill_zone.confirm.confirm_button', { cost: confirmingContest.slotCostCredits })}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Ready-To-Start Screen — slot already bought; the timer/attempt only begins
          once the player presses Start, so purchase confirmation delay never counts
          against their race time. */}
      {reservedContest && (
        <section className="lx-bleed relative overflow-hidden">
          <div className="pointer-events-none absolute left-1/2 top-24 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[#22d3ee]/15 blur-[130px]" aria-hidden="true" />
          <div className="relative mx-auto max-w-[760px] px-5 pb-20 pt-28 text-center md:px-10 md:pt-36">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#22d3ee]">{reservedContest.title}</p>
            <h1 className="mt-3 text-[clamp(2.2rem,6vw,4rem)] font-black leading-[0.92] tracking-[-0.045em] text-white">
              {t('skill_zone.confirm.ready_heading')}
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-white/60">{t('skill_zone.confirm.ready_text')}</p>

            {/* Rotate-device prompt — a landscape puzzle image squeezed into a portrait
                phone screen was the real reason pieces ended up too small to tap/drag
                accurately. Reactive: goes away the moment the player actually rotates. */}
            {pendingImageIsPortrait === false && deviceIsPortrait && (
              <div className="mt-6 flex items-center gap-3 rounded-2xl border-2 border-amber-300 bg-amber-500 p-4 text-left shadow-lg shadow-amber-500/40 animate-pulse">
                <Smartphone className="h-10 w-10 shrink-0 rotate-90 text-black" strokeWidth={2.5} />
                <p className="text-sm font-black uppercase leading-snug tracking-tight text-black">{t('skill_zone.confirm.rotate_device')}</p>
              </div>
            )}

            <div className="relative mx-auto mt-8 w-full max-w-xs">
              <div className="lx-arena-ring pointer-events-none absolute -inset-2 rounded-[36px]" aria-hidden="true" />
              <img src={contestImage(reservedContest, 700)} alt={reservedContest.title} className="relative aspect-square w-full rounded-[28px] border border-white/10 bg-black object-cover" />
            </div>

            {/* How-to-play — shown before the clock starts, so reading it never costs time. */}
            <div className="mt-8 text-left">
              <p className="mb-3 text-center text-xs font-black uppercase tracking-[0.2em] text-white/45">{t('skill_zone.confirm.howto_title')}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  [Move, 'howto_drag', 'text-[#22d3ee]'],
                  [RotateCw, 'howto_rotate', 'text-[#22d3ee]'],
                  [Puzzle, 'howto_shape', 'text-[#22d3ee]'],
                  [ShieldAlert, 'howto_tabswitch', 'text-[#ff5a36]'],
                ].map(([Icon, key, color]) => (
                  <div key={key} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
                    <p className="text-sm leading-snug text-white/75">{t(`skill_zone.confirm.${key}`)}</p>
                  </div>
                ))}
              </div>
            </div>

            {uploadProgress && (
              <p className="lx-ping-soft mt-5 rounded-xl bg-[#8b5cf6]/15 px-4 py-3 text-sm font-bold text-white">{uploadProgress}</p>
            )}

            <div className="mt-8 flex flex-col-reverse items-stretch justify-center gap-3 sm:flex-row">
              <button type="button" onClick={cancelReserved} className={`${stageButton} border border-white/15 text-white hover:border-white/40`}>
                {t('skill_zone.confirm.cancel_reserved_button')}
              </button>
              <button type="button" onClick={handleStartAttempt} className={`${stageButton} bg-[#c6ff3d] px-10 text-base text-[#10140a] hover:-translate-y-0.5`}>
                {t('skill_zone.confirm.continue_button')} <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Play Area — a true full-viewport takeover (fixed inset-0, above everything
          including the site header/nav) so the game gets the whole screen like a
          native app. Body scroll is locked and native fullscreen is best-effort
          requested while this is up — see the effect and handleStartAttempt above. */}
      {playingContest ? (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#07060b]">
          <div className="flex min-h-full flex-col p-2 sm:p-4">
            <div className="flex min-h-0 flex-1 items-center justify-center">
              {gameResult ? (
                <div className="relative mx-auto flex max-w-md flex-col items-center justify-center px-4 py-12 text-center">
                  <div className={`pointer-events-none absolute top-0 h-72 w-72 rounded-full blur-[110px] ${gameResult.status === 'cheated' ? 'bg-[#ff5a36]/25' : 'bg-[#22d3ee]/25'}`} aria-hidden="true" />
                  {gameResult.status === 'cheated' ? (
                    <>
                      <ShieldAlert className="relative h-16 w-16 animate-pulse text-[#ff5a36]" />
                      <h3 className="relative mt-5 text-3xl font-black tracking-[-0.02em] text-white">{t('skill_zone.play.voided_title')}</h3>
                      <p className="relative mb-8 mt-3 text-sm leading-relaxed text-white/60">{t('skill_zone.play.voided_text')}</p>
                    </>
                  ) : (
                    <>
                      <Trophy className="relative h-16 w-16 text-[#facc15]" />
                      <h3 className="relative mt-5 text-3xl font-black tracking-[-0.02em] text-white">{t('skill_zone.play.success_title')}</h3>
                      <p className="relative mt-4 font-mono text-4xl font-black tabular-nums text-[#22d3ee]">
                        {formatRaceTime(gameResult.timeMs)}
                      </p>
                      <p className="relative mt-1 text-xs font-bold uppercase tracking-wider text-white/45">
                        {t('arena_page.result.time_label')}
                      </p>
                      {gameResult.contestFinalized ? (
                        <div className="relative mb-8 mt-6 rounded-2xl border border-[#facc15]/40 bg-[#facc15]/10 px-4 py-3 text-sm text-white">
                          {t('skill_zone.play.contest_finalized')} <span className="font-black text-[#facc15]">{gameResult.winnerName}</span>
                        </div>
                      ) : (
                        <p className="relative mb-8 mt-6 text-sm text-white/60">{t('skill_zone.play.waiting_others')}</p>
                      )}
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setPlayingContest(null);
                      setAttemptToken(null);
                      setGameResult(null);
                      fetchCatalogData();
                    }}
                    className={`${stageButton} relative bg-white text-[#07060b] hover:-translate-y-0.5`}
                  >
                    {t('skill_zone.play.return_lobby')}
                  </button>
                </div>
              ) : attemptToken ? (
                <JigsawPuzzle
                  imageUrl={normalizeImageUrl(playingContest.imageUrl)}
                  contestId={playingContest.id}
                  attemptToken={attemptToken}
                  isPortrait={boardIsPortrait}
                  onPieceLocked={handlePieceLocked}
                  onComplete={handleCompleteAttempt}
                  onCancel={() => {
                    setPlayingContest(null);
                    setAttemptToken(null);
                    fetchCatalogData();
                  }}
                />
              ) : (
                // Ready panel: the real "Start" — pressing THIS is what calls
                // /api/contest/start (handleBeginSolving above). No clock is
                // running yet at any point on this panel.
                <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
                  {!readyBannerDismissed && (
                    <div className="relative w-full rounded-2xl border border-[#8b5cf6]/40 bg-[#8b5cf6]/10 p-4 pr-11 text-left">
                      <button
                        type="button"
                        onClick={() => setReadyBannerDismissed(true)}
                        className="absolute right-1.5 top-1.5 flex h-10 w-10 items-center justify-center text-white/50 hover:text-white"
                        aria-label="dismiss"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <h2 className="text-base font-black text-white">{playingContest.title}</h2>
                      <p className="mt-1 text-sm leading-relaxed text-white/60">{t('skill_zone.play.instructions')}</p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleBeginSolving}
                    className="lx-shine relative flex items-center gap-3 overflow-hidden rounded-3xl bg-[#c6ff3d] px-12 py-6 text-xl font-black text-[#10140a] shadow-[0_20px_60px_-15px_rgba(198,255,61,0.6)] transition-transform hover:-translate-y-0.5 active:scale-95"
                  >
                    <Play className="h-7 w-7" />
                    {t('skill_zone.confirm.start_button')}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPlayingContest(null);
                      fetchCatalogData();
                    }}
                    className="px-4 py-3 text-sm font-bold text-white/50 hover:text-white"
                  >
                    {t('skill_zone.confirm.cancel_reserved_button')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {!confirmingContest && !reservedContest && !playingContest && (
        <>
          <ArenaHero
            contests={contests}
            user={user}
            wallet={wallet}
            spotlight={spotlight}
            spotlightLeaderboard={spotlight ? leaderboards[spotlight.id] || [] : []}
            onPlay={openConfirm}
          />

          {user?.role === 'admin' && (
            <section className="lx-bleed relative">
              <div className="mx-auto max-w-[1320px] px-5 md:px-10">
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-[#ff5a36]/40 bg-[#ff5a36]/5 p-3">
                  <span className="px-2 text-xs font-black uppercase tracking-wider text-[#ff5a36]">Admin</span>
                  <button
                    type="button"
                    onClick={() => setIsAdminFormOpen(!isAdminFormOpen)}
                    className="flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-2.5 text-sm font-bold text-white hover:border-white/40"
                  >
                    <PlusCircle className="h-4 w-4 shrink-0" /> {t('skill_zone.actions.upload_full')}
                  </button>
                </div>
          {/* Admin Create/Upload Contest Form */}
          {user?.role === 'admin' && isAdminFormOpen && (
            <div className="bento-card mt-4 p-6 mb-8 border border-pink-500/30 bg-[#14120b]/50 rounded-2xl relative shadow-xl">
              <div className="absolute top-4 right-4 z-20">
                <button 
                  onClick={() => setIsAdminFormOpen(false)}
                  className="text-stone-450 text-stone-400 hover:text-white font-mono text-xs uppercase"
                >
                  {t('skill_zone.form.close')}
                </button>
              </div>

              <h2 className="text-lg font-black uppercase text-pink-400 font-mono mb-4 flex items-center gap-2">
                🧩 {t('skill_zone.form.heading')}
              </h2>

              {/* Reference item price lookup — search real catalog data to suggest
                  a market value, slot count, and entry cost instead of guessing blind. */}
              <div className="mb-5 p-4 bg-black/30 border border-pink-500/20 rounded-xl relative">
                <label className="block text-stone-300 font-bold uppercase mb-1 text-xs">
                  {t('skill_zone.form.ref_search_label')}
                </label>
                <p className="text-[10px] text-stone-500 mb-2">{t('skill_zone.form.ref_search_hint')}</p>
                <input
                  type="text"
                  value={refQuery}
                  onChange={e => setRefQuery(e.target.value)}
                  placeholder={t('skill_zone.form.ref_search_placeholder')}
                  className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-white outline-none focus:border-pink-500 font-mono text-xs"
                />

                {refSearching && (
                  <div className="mt-2 text-[10px] text-stone-500 font-mono">{t('skill_zone.form.ref_searching')}</div>
                )}

                {refResults.length > 0 && (
                  <div className="mt-2 max-h-56 overflow-y-auto border border-white/10 rounded bg-[#0a0806] divide-y divide-white/5">
                    {refResults.map((item, i) => (
                      <button
                        type="button"
                        key={item.set_num || item.external_id || item.id || i}
                        onClick={() => handleSelectRefItem(item)}
                        className="w-full flex items-center gap-3 p-2 hover:bg-pink-500/10 transition-colors text-left"
                      >
                        {item.img_url ? (
                          <img src={item.img_url} alt={item.name} className="w-8 h-8 object-contain rounded bg-black/40 shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-black/40 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-bold text-white truncate">{item.name}</div>
                          {item.details?.priceEur ? (
                            <div className="text-[10px] text-emerald-400 font-mono">~€{parseFloat(item.details.priceEur).toFixed(2)}</div>
                          ) : item.year ? (
                            <div className="text-[10px] text-stone-500 font-mono">{item.year}</div>
                          ) : null}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {refSelected && (
                  <div className="mt-3 flex items-center gap-3 p-2 bg-emerald-950/20 border border-emerald-500/30 rounded">
                    {refSelected.imgUrl && (
                      <img src={refSelected.imgUrl} alt={refSelected.name} className="w-10 h-10 object-contain rounded bg-black/40 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold text-emerald-400 truncate">✓ {refSelected.name}</div>
                      <div className="text-[10px] text-stone-400 font-mono">
                        {refSelected.priceEur
                          ? t('skill_zone.form.ref_suggestion_applied', { price: refSelected.priceEur.toFixed(2) })
                          : t('skill_zone.form.ref_no_price')}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={handleCreateContestSubmit} className="space-y-4 font-sans text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-stone-300 font-bold uppercase mb-1">{t('skill_zone.form.title_label')}</label>
                      <input
                        type="text"
                        value={newContestTitle}
                        onChange={e => setNewContestTitle(e.target.value)}
                        placeholder={t('skill_zone.form.title_placeholder')}
                        className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-white outline-none focus:border-pink-500 font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-stone-300 font-bold uppercase mb-1">{t('skill_zone.form.description_label')}</label>
                      <textarea
                        value={newContestDesc}
                        onChange={e => setNewContestDesc(e.target.value)}
                        placeholder={t('skill_zone.form.description_placeholder')}
                        rows={3}
                        className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-white outline-none focus:border-pink-500 font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-stone-300 font-bold uppercase mb-1">{t('skill_zone.form.category_label')}</label>
                        <select
                          value={newContestCat}
                          onChange={e => setNewContestCat(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-white outline-none focus:border-pink-500 font-mono"
                        >
                          {CATALOG_GAMES.map(game => (
                            <option key={game.slug} value={game.slug}>{game.emoji} {game.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-stone-300 font-bold uppercase mb-1">{t('skill_zone.form.slots_label')}</label>
                        <input 
                          type="number"
                          value={newContestSlots}
                          onChange={e => setNewContestSlots(parseInt(e.target.value, 10))}
                          min={2}
                          max={100}
                          className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-white outline-none focus:border-pink-500 font-mono"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-stone-300 font-bold uppercase mb-1">{t('skill_zone.form.value_label')}</label>
                        <input 
                          type="number"
                          value={newContestVal}
                          onChange={e => setNewContestVal(parseFloat(e.target.value))}
                          min={1}
                          className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-white outline-none focus:border-pink-500 font-mono"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-stone-300 font-bold uppercase mb-1">{t('skill_zone.form.cost_label')}</label>
                        <input 
                          type="number"
                          value={newContestCost}
                          onChange={e => setNewContestCost(parseFloat(e.target.value))}
                          min={1}
                          className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-white outline-none focus:border-pink-500 font-mono"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-stone-300 font-bold uppercase mb-1">{t('skill_zone.form.condition_label')}</label>
                        <input
                          type="text"
                          value={newContestCond}
                          onChange={e => setNewContestCond(e.target.value)}
                          placeholder={t('skill_zone.form.condition_placeholder')}
                          className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-white outline-none focus:border-pink-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-stone-300 font-bold uppercase mb-1">{t('skill_zone.form.grading_label')}</label>
                        <input
                          type="text"
                          value={newContestGrading}
                          onChange={e => setNewContestGrading(e.target.value)}
                          placeholder={t('skill_zone.form.grading_placeholder')}
                          className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-white outline-none focus:border-pink-500 font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-stone-300 font-bold uppercase mb-1">{t('skill_zone.form.image_label')}</label>
                      <input 
                        type="file"
                        onChange={e => setNewContestFile(e.target.files[0])}
                        accept="image/*"
                        className="w-full text-stone-300 bg-black/40 border border-white/10 rounded px-3 py-1.5 focus:border-pink-500 font-mono"
                        required
                      />
                    </div>
                  </div>
                </div>

                {uploadProgress && (
                  <div className="p-3 bg-pink-950/20 border border-pink-500/20 text-pink-400 text-center font-bold font-mono text-[10px] rounded animate-pulse">
                    ⏳ {uploadProgress}
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <button 
                    type="submit"
                    className="px-6 py-2.5 bg-pink-500 hover:bg-pink-400 text-white font-extrabold rounded-lg uppercase tracking-wider transition-all duration-300 shadow-lg shadow-pink-500/20 active-shrink font-mono"
                  >
                    {t('skill_zone.form.submit')}
                  </button>
                </div>
              </form>
            </div>
          )}
              </div>
            </section>
          )}

          {user?.role !== 'admin' && <ArenaSteps />}

          {/* ================= LOBBY ================= */}
          <section className="lx-bleed relative pb-24 pt-10 md:pb-32 md:pt-14" id="arena-lobby">
            <div className="mx-auto max-w-[1320px] px-5 md:px-10">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[#22d3ee]">{t('arena_page.lobby.kicker')}</p>
                  <h2 className="mt-3 text-[clamp(2rem,5vw,3.6rem)] font-black leading-[0.95] tracking-[-0.045em] text-white">{t('arena_page.lobby.title')}</h2>
                </div>
                <p className="flex items-center gap-2 text-sm font-semibold text-white/55">
                  <span className="relative flex h-2 w-2">
                    <span className="lx-ping absolute inline-flex h-full w-full rounded-full bg-[#c6ff3d]" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#c6ff3d]" />
                  </span>
                  {t('arena_page.lobby.live')}
                </p>
              </div>

              {/* Category Filter */}
              <div className="lx-rail -mx-5 mt-8 flex items-center gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:px-0">
                {[{ slug: 'all', name: t('skill_zone.lobby.filter_all') }, ...CATALOG_GAMES].map((game) => {
                  const active = categoryFilter === game.slug;
                  return (
                    <button
                      key={game.slug}
                      type="button"
                      onClick={() => setCategoryFilter(game.slug)}
                      aria-pressed={active}
                      className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2.5 text-sm font-bold transition-all ${
                        active
                          ? 'border-transparent bg-gradient-to-r from-[#8b5cf6] to-[#22d3ee] text-white'
                          : 'border-white/12 text-white/70 hover:border-white/40 hover:text-white'
                      }`}
                    >
                      {game.name}
                    </button>
                  );
                })}
              </div>

              <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {lobbyContests.length === 0 ? (
                  <div className="col-span-full flex flex-col items-center rounded-[32px] border border-dashed border-white/15 px-6 py-16 text-center">
                    <Trophy className="h-12 w-12 text-[#22d3ee]" />
                    <h3 className="mt-5 text-2xl font-black text-white">
                      {contests.length === 0 ? t('skill_zone.lobby.empty_title') : t('skill_zone.lobby.empty_filtered_title')}
                    </h3>
                    <p className="mt-2 text-sm text-white/55">
                      {contests.length === 0 ? t('skill_zone.lobby.empty_text') : t('skill_zone.lobby.empty_filtered_text')}
                    </p>
                    {contests.length > 0 ? (
                      <button type="button" onClick={() => setCategoryFilter('all')} className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-black text-[#07060b]">
                        {t('skill_zone.lobby.filter_all')}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  lobbyContests.map((con, i) => (
                    <ContestCard
                      key={con.id}
                      contest={con}
                      leaderboard={leaderboards[con.id] || []}
                      user={user}
                      onPlay={openConfirm}
                      index={i}
                    />
                  ))
                )}
              </div>
            </div>
          </section>
        </>
      )}

    </div>
  );
}

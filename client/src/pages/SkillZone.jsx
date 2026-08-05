import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../auth/useAuth';
import { apiFetch, normalizeImageUrl, formatRaceTime, TOKEN_STORAGE_KEY } from '../api';
import JigsawPuzzle from '../components/JigsawPuzzle';
import { Link, useNavigate } from 'react-router-dom';
import {
  Trophy, Coins, ShieldAlert, Sparkles,
  Layers, Hammer, ChevronRight, Zap, RefreshCw, PlusCircle, CheckCircle, Flame
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function SkillZone() {
  const { user, refreshWallet } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  // App Layout States
  const [activeDivision, setActiveDivision] = useState('lego'); // lego | pokemon
  const [activeTab, setActiveTab] = useState('lobby'); // lobby (contests) | auctions (live bids)

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

  // Catalog Data Lists
  const [contests, setContests] = useState([]);
  const [auctions, setAuctions] = useState([]);
  const [leaderboards, setLeaderboards] = useState({}); // key: contestId -> []
  
  // Game Session States
  const [playingContest, setPlayingContest] = useState(null); // contest details
  const [attemptToken, setAttemptToken] = useState(null); // anti-cheat start token
  const [gameResult, setGameResult] = useState(null); // leaderboard status after submission

  // Alerts & Messages
  const [sysAlert, setSysAlert] = useState(null);
  const [sysSuccess, setSysSuccess] = useState(null);

  // WebSockets Ref
  const wsRef = useRef(null);

  // Fetch all initial metadata
  const fetchCatalogData = async () => {
    try {
      // 1. Contests
      const contData = await apiFetch('/api/contest/list');
      if (contData && contData.contests) setContests(contData.contests);

      // 2. Auctions
      const aucData = await apiFetch('/api/auctions');
      if (aucData && aucData.auctions) setAuctions(aucData.auctions);
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

        if (message.type === 'BID_PLACED') {
          const { auctionId, currentBid, highestBidderId, highestBidderName } = message.payload;
          setAuctions(prev => prev.map(auc => {
            if (auc.id === auctionId) {
              return { ...auc, currentBid, highestBidderId, highestBidderName };
            }
            return auc;
          }));
          triggerSystemAlert(t('skill_zone.alerts.new_bid', { amount: currentBid }));
        }

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

  // Buy Slot Handler
  const handleBuySlot = async (contestId) => {
    if (!user) return;

    try {
      const data = await apiFetch('/api/contest/buy-slot', {
        method: 'POST',
        body: { contestId }
      });

      refreshWallet();
      fetchCatalogData();
      fetchLeaderboard(contestId);
      triggerSystemSuccess(data.message);
    } catch (err) {
      triggerSystemAlert(err.message || t('skill_zone.alerts.buy_slot_failed'));
    }
  };

  // Start attempt handler (Anti-cheat JWT)
  const handleStartAttempt = async (contestId) => {
    try {
      const data = await apiFetch('/api/contest/start', {
        method: 'POST',
        body: { contestId }
      });

      const contestDetails = contests.find(c => c.id === contestId);
      setPlayingContest(contestDetails);
      setAttemptToken(data.attemptToken);
      setGameResult(null);
    } catch (err) {
      triggerSystemAlert(err.message || t('skill_zone.alerts.start_error'));
    }
  };

  // Combined play handler — every play is a new paid entry (credits are deducted from the
  // wallet on each attempt), repeatable by the same user until the contest's slots fill up.
  const handlePlayContest = async (con) => {
    if (!user) return;

    if (con.status !== 'open') {
      triggerSystemAlert(t('skill_zone.alerts.contest_closed'));
      return;
    }

    try {
      setUploadProgress(t('skill_zone.alerts.acquiring_ticket'));
      const buyData = await apiFetch('/api/contest/buy-slot', {
        method: 'POST',
        body: { contestId: con.id }
      });
      refreshWallet();
      triggerSystemSuccess(buyData.message);

      setUploadProgress(t('skill_zone.alerts.preparing_engine'));
      const startData = await apiFetch('/api/contest/start', {
        method: 'POST',
        body: { contestId: con.id }
      });
      
      // Refresh local states
      fetchCatalogData();
      fetchLeaderboard(con.id);

      // Start gameplay canvas
      setPlayingContest(con);
      setAttemptToken(startData.attemptToken);
      setGameResult(null);
      setUploadProgress('');
    } catch (err) {
      setUploadProgress('');
      triggerSystemAlert(err.message || t('skill_zone.alerts.launch_error'));
    }
  };

  // Complete attempt handler
  const handleCompleteAttempt = async ({ contestId, attemptToken, blurCount, totalBlurTimeMs }) => {
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

  // Place Bid on Auction
  const handlePlaceBid = async (auctionId, bidAmount) => {
    if (!user) return;

    try {
      const data = await apiFetch('/api/auctions/bid', {
        method: 'POST',
        body: { auctionId, bidAmount }
      });

      refreshWallet();
      fetchCatalogData();
      triggerSystemSuccess(data.message);
    } catch (err) {
      triggerSystemAlert(err.message || t('skill_zone.alerts.bid_error'));
    }
  };

  // Direct Buy Checkout (used by the auctions "Buy Instantly" action)
  const handleDirectBuy = async (productId) => {
    if (!user) return;

    try {
      const data = await apiFetch('/api/wallet/buy-product', {
        method: 'POST',
        body: { productId }
      });

      refreshWallet();
      fetchCatalogData();
      triggerSystemSuccess(data.message);
    } catch (err) {
      triggerSystemAlert(err.message || t('skill_zone.alerts.purchase_error'));
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

      // Refresh catalog data
      fetchCatalogData();
    } catch (err) {
      setUploadProgress('');
      triggerSystemAlert(err.message || t('skill_zone.alerts.upload_error'));
    }
  };

  // Segment catalogs by category (LEGO vs Pokémon)
  const filteredContests = contests.filter(c => c.category === activeDivision);
  const filteredAuctions = auctions.filter(a => a.category === activeDivision);

  return (
    <div className="min-h-screen pb-16 bg-[#05050a] text-stone-100 px-4 md:px-6 max-w-[1400px] mx-auto pt-6">
      {/* Global Alerts */}
      {sysAlert && (
        <div className="fixed right-6 top-20 z-50 flex items-center space-x-3 rounded-lg border border-red-500 bg-red-950/90 p-4 text-red-300 shadow-lg backdrop-blur-md animate-slide-in">
          <ShieldAlert className="h-5 w-5 text-red-400" />
          <span className="font-mono text-xs font-bold uppercase">{sysAlert}</span>
        </div>
      )}
      {sysSuccess && (
        <div className="fixed right-6 top-20 z-50 flex items-center space-x-3 rounded-lg border border-emerald-500 bg-emerald-950/90 p-4 text-emerald-300 shadow-lg backdrop-blur-md animate-slide-in">
          <CheckCircle className="h-5 w-5 text-emerald-400" />
          <span className="font-mono text-xs font-bold uppercase">{sysSuccess}</span>
        </div>
      )}

      {/* Main Header / Banner */}
      <div className="bento-card p-6 md:p-8 relative overflow-hidden mb-8 border border-white/5 bg-[#14120b]/30 rounded-3xl">
        <div className="absolute top-0 right-0 w-48 h-48 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gold-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-pink-500/30 bg-pink-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-pink-400">
              <Flame className="h-3.5 w-3.5 animate-pulse text-pink-500" /> {t('skill_zone.banner.badge')}
            </div>
            <h1 className="text-2xl md:text-3xl font-black uppercase font-mono tracking-wider text-white mt-4">
              {t('skill_zone.banner.title')}
            </h1>
            <p className="text-xs md:text-sm text-stone-400 mt-2 max-w-xl leading-relaxed">
              {t('skill_zone.banner.subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-3 bg-black/40 p-1.5 rounded-xl border border-white/5 shrink-0 self-start md:self-auto">
            <button
              onClick={() => setActiveDivision('lego')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all duration-300 ${
                activeDivision === 'lego'
                  ? 'bg-gold-500 text-white font-extrabold shadow-lg shadow-gold-500/15'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              🧱 {t('skill_zone.division.lego')}
            </button>
            <button
              onClick={() => setActiveDivision('pokemon')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all duration-300 ${
                activeDivision === 'pokemon'
                  ? 'bg-pink-500 text-white font-extrabold shadow-lg shadow-pink-500/15'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              🃏 {t('skill_zone.division.pokemon')}
            </button>
          </div>
        </div>
      </div>

      {/* User check */}
      {!user ? (
        <div className="bento-card p-12 text-center rounded-2xl border border-white/5 bg-[#14120b]/30 max-w-md mx-auto my-12">
          <ShieldAlert className="h-12 w-12 text-pink-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold uppercase font-mono text-white">{t('skill_zone.access.title')}</h2>
          <p className="text-xs text-stone-400 mt-2 mb-6">
            {t('skill_zone.access.text')}
          </p>
          <Link
            to="/login"
            className="px-6 py-2.5 bg-gold-500 hover:bg-gold-400 text-white rounded-xl font-bold uppercase text-xs tracking-wider transition-all shadow-lg shadow-gold-500/25 active-shrink"
          >
            {t('skill_zone.access.cta')}
          </Link>
        </div>
      ) : (
        <>
          {/* Play Area Overlay Panel */}
          {playingContest ? (
            <div className="bento-card p-6 mb-8 border border-gold-500/30 bg-[#0a0806]/90 rounded-2xl relative shadow-2xl">
              <div className="absolute top-4 right-4 z-20">
                <span className="inline-flex items-center text-[10px] uppercase font-mono font-bold bg-gold-950/80 border border-gold-400 text-gold-400 px-2.5 py-1 rounded">
                  ⚡ {t('skill_zone.play.secure_room')}
                </span>
              </div>

              <div className="text-center mb-6">
                <h2 className="text-xl font-extrabold tracking-wide uppercase text-white font-mono">
                  {t('skill_zone.play.heading', { title: playingContest.title })}
                </h2>
                <p className="text-xs text-stone-400 mt-1">
                  {t('skill_zone.play.instructions')}
                </p>
              </div>

              {gameResult ? (
                <div className="flex flex-col items-center justify-center py-12 text-center max-w-md mx-auto">
                  {gameResult.status === 'cheated' ? (
                    <>
                      <ShieldAlert className="h-16 w-16 text-pink-500 mb-4 animate-pulse" />
                      <h3 className="text-xl font-bold text-pink-500 uppercase tracking-wider">{t('skill_zone.play.voided_title')}</h3>
                      <p className="text-xs text-stone-400 mt-2 mb-6">
                        {t('skill_zone.play.voided_text')}
                      </p>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-16 w-16 text-emerald-400 mb-4" />
                      <h3 className="text-xl font-bold text-emerald-400 uppercase tracking-wider">{t('skill_zone.play.success_title')}</h3>
                      <p className="text-sm font-mono text-white font-bold mt-2">
                        {t('skill_zone.play.speed_score', { time: formatRaceTime(gameResult.timeMs) })}
                      </p>
                      {gameResult.contestFinalized ? (
                        <div className="mt-4 p-3 bg-pink-950/30 border border-pink-500/30 rounded text-xs text-stone-300">
                          🎉 {t('skill_zone.play.contest_finalized')} <span className="font-extrabold text-pink-400">{gameResult.winnerName}</span>.
                        </div>
                      ) : (
                        <p className="text-xs text-stone-400 mt-2 mb-6">
                          {t('skill_zone.play.waiting_others')}
                        </p>
                      )}
                    </>
                  )}

                  <button
                    onClick={() => {
                      setPlayingContest(null);
                      setAttemptToken(null);
                      setGameResult(null);
                      fetchCatalogData();
                    }}
                    className="px-6 py-2 bg-gold-500 text-white hover:bg-gold-400 rounded-lg font-bold font-mono text-xs uppercase tracking-wider transition-all duration-300 active-shrink shadow-lg shadow-gold-500/15"
                  >
                    {t('skill_zone.play.return_lobby')}
                  </button>
                </div>
              ) : (
                <JigsawPuzzle 
                  imageUrl={normalizeImageUrl(playingContest.imageUrl)}
                  contestId={playingContest.id}
                  attemptToken={attemptToken}
                  onComplete={handleCompleteAttempt}
                  onCancel={() => {
                    setPlayingContest(null);
                    setAttemptToken(null);
                    fetchCatalogData();
                  }}
                />
              )}
            </div>
          ) : null}

          {/* Dashboard Tabs & Toggles */}
          {!playingContest && (
            <>
              <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 pb-4 mb-8 gap-4">
                <div className="flex items-center gap-1 p-1 bg-black/40 rounded-lg border border-white/5 w-full sm:w-auto sm:max-w-sm">
              <button
                onClick={() => setActiveTab('lobby')}
                className={`flex-1 sm:flex-none flex items-center justify-center space-x-1 sm:space-x-1.5 px-2 sm:px-4 py-2 rounded-md text-[10px] sm:text-xs font-bold uppercase transition-all duration-300 ${
                  activeTab === 'lobby'
                    ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/15'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                <Trophy className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">{t('skill_zone.tabs.arena_full')}</span>
                <span className="sm:hidden">{t('skill_zone.tabs.arena_short')}</span>
              </button>
              <button
                onClick={() => setActiveTab('auctions')}
                className={`flex-1 sm:flex-none flex items-center justify-center space-x-1 sm:space-x-1.5 px-2 sm:px-4 py-2 rounded-md text-[10px] sm:text-xs font-bold uppercase transition-all duration-300 ${
                  activeTab === 'auctions'
                    ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/15'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                <Hammer className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">{t('skill_zone.tabs.drops_full')}</span>
                <span className="sm:hidden">{t('skill_zone.tabs.drops_short')}</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              {true && (
                <button
                  onClick={() => setIsAdminFormOpen(!isAdminFormOpen)}
                  className="flex items-center space-x-1.5 px-2.5 py-1.5 sm:px-3 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/40 text-pink-400 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all duration-300"
                >
                  <PlusCircle className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">{t('skill_zone.actions.upload_full')}</span>
                  <span className="sm:hidden">{t('skill_zone.actions.upload_short')}</span>
                </button>
              )}

              <button
                onClick={() => navigate('/crediti/acquista')}
                className="flex items-center space-x-1.5 px-2.5 py-1.5 sm:px-3 bg-gold-500/10 hover:bg-gold-500/20 border border-gold-500/40 text-gold-400 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all duration-300"
              >
                <PlusCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">{t('skill_zone.actions.add_credits_full')}</span>
                <span className="sm:hidden">{t('skill_zone.actions.add_credits_short')}</span>
              </button>

              <div className="hidden sm:flex items-center space-x-3 text-xs text-stone-400 font-mono bg-black/20 px-3 py-1.5 rounded-lg border border-white/5">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span>{t('skill_zone.actions.portal_sync')} <span className="text-white font-bold">{t('skill_zone.actions.online')}</span></span>
              </div>
            </div>
          </div>

          {/* Admin Create/Upload Contest Form */}
          {isAdminFormOpen && (
            <div className="bento-card p-6 mb-8 border border-pink-500/30 bg-[#14120b]/50 rounded-2xl relative shadow-xl">
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
                          <option value="lego">🧱 {t('skill_zone.form.category_lego')}</option>
                          <option value="pokemon">🃏 {t('skill_zone.form.category_pokemon')}</option>
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

          {/* ================= SKILL ZONE LOBBY ================= */}
          {activeTab === 'lobby' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {filteredContests.length === 0 ? (
                <div className="col-span-2 text-center py-20 border border-dashed border-white/5 rounded-xl bg-[#14120b]/10">
                  <Trophy className="h-12 w-12 text-stone-500 mx-auto mb-3" />
                  <h3 className="font-bold text-white uppercase font-mono">{t('skill_zone.lobby.empty_title')}</h3>
                  <p className="text-xs text-stone-400 mt-1">{t('skill_zone.lobby.empty_text')}</p>
                </div>
              ) : (
                filteredContests.map(con => {
                  const leaderboard = leaderboards[con.id] || [];
                  const isParticipating = leaderboard.some(p => p.userId === user.id);

                  return (
                    <div 
                      key={con.id} 
                      onClick={() => handlePlayContest(con)}
                      className="bento-card border border-white/5 bg-[#14120b]/20 rounded-2xl overflow-hidden hover:border-gold-500/30 transition-all duration-300 flex flex-col md:flex-row shadow-lg cursor-pointer group"
                    >
                      
                      {/* Image Block */}
                      <div className="w-full md:w-48 h-48 md:h-auto relative flex-shrink-0 bg-black">
                        <img 
                          src={normalizeImageUrl(con.imageUrl)} 
                          alt={con.title} 
                          className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-all duration-500"
                        />
                        <div className="absolute top-2 left-2 flex flex-col space-y-1">
                          <span className="text-[9px] bg-black/80 text-gold-400 border border-gold-500/30 px-2 py-0.5 rounded font-bold font-mono">
                            {t('skill_zone.lobby.value', { value: con.marketValue })}
                          </span>
                          <span className="text-[9px] bg-black/80 text-pink-400 border border-pink-500/30 px-2 py-0.5 rounded font-bold font-mono">
                            {con.condition}
                          </span>
                        </div>
                      </div>

                      {/* Content Block */}
                      <div className="p-5 flex-1 flex flex-col justify-between">
                        <div>
                          <h3 className="text-base font-extrabold text-white leading-tight uppercase font-mono truncate max-w-[280px] group-hover:text-gold-400 transition-colors">
                            {con.title}
                          </h3>
                          <p className="text-[10px] text-stone-400 mt-1 leading-snug">
                            {con.gradingInfo || t('skill_zone.lobby.condition_fallback')}
                          </p>

                          {/* Slots Progress Bar */}
                          <div className="mt-4">
                            <div className="flex justify-between items-center text-[10px] font-mono text-stone-400 mb-1">
                              <span>{t('skill_zone.lobby.slots_filled')}</span>
                              <span className="text-white font-bold">{con.filledSlots} / {con.totalSlots}</span>
                            </div>
                            <div className="w-full h-2 bg-black/50 rounded overflow-hidden">
                              <div 
                                className="h-full bg-gold-500 shadow-md shadow-gold-500/40 transition-all duration-300"
                                style={{ width: `${(con.filledSlots / con.totalSlots) * 100}%` }}
                              ></div>
                            </div>
                            <div className="flex justify-between items-center mt-1 text-[8px] font-mono">
                              <span className="text-stone-400 uppercase">{t('skill_zone.lobby.cost_to_enter')}</span>
                              <span className="text-gold-400 font-bold text-[10px]">{con.slotCostCredits} CR</span>
                            </div>
                          </div>
                        </div>

                        {/* Entry and gameplay controls — every click is a new paid entry,
                            repeatable by the same user until the contest's slots fill up. */}
                        <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                          {con.status === 'open' ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); handlePlayContest(con); }}
                              className="w-full py-2 bg-gold-500 hover:bg-gold-400 text-white font-extrabold rounded font-mono text-xs uppercase tracking-wider transition-all duration-300 shadow-lg shadow-gold-500/15 active-shrink"
                            >
                              {isParticipating ? `🕹️ ${t('skill_zone.lobby.play_again')}` : t('skill_zone.lobby.buy_slot_play')} ({con.slotCostCredits} CR)
                            </button>
                          ) : (
                            <span className="inline-flex items-center text-[10px] text-stone-400 font-mono uppercase bg-black/40 px-3 py-1.5 rounded">
                              {t('skill_zone.lobby.status_full')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Leaderboard panel inside card */}
                      <div 
                        onClick={(e) => e.stopPropagation()} 
                        className="w-full md:w-56 bg-black/40 p-4 border-t md:border-t-0 md:border-l border-white/5 font-mono"
                      >
                        <div className="flex items-center justify-between text-[10px] uppercase font-bold text-stone-400 pb-2 border-b border-white/5 mb-2">
                          <span>{t('skill_zone.lobby.leaderboard')}</span>
                          <Trophy className="h-3 w-3 text-gold-400" />
                        </div>
                        <div className="pr-1">
                          {leaderboard.length === 0 ? (
                            <div className="text-[9px] text-stone-500 text-center py-4">{t('skill_zone.lobby.no_attempts')}</div>
                          ) : (
                            <table className="w-full text-[10px] border-collapse">
                              <tbody>
                                {leaderboard.slice(0, 5).map((ld, i) => {
                                  const podiumColor =
                                    i === 0 ? 'text-gold-400'   // gold
                                    : i === 1 ? 'text-stone-300'  // silver
                                    : i === 2 ? 'text-[#CD7F32]'  // bronze
                                    : 'text-white';                // 4th & 5th
                                  return (
                                    <tr key={ld.id} className="border-b border-white/5">
                                      <td className="py-1 pr-1 font-bold text-stone-500 w-4">{i + 1}</td>
                                      <td className={`py-1 pr-1 font-semibold truncate max-w-[90px] ${podiumColor}`}>{ld.username}</td>
                                      <td className="py-1 text-right font-semibold text-gold-400">
                                        {ld.status === 'completed'
                                          ? formatRaceTime(ld.totalTimeMs)
                                          : ld.status === 'cheated'
                                            ? `🚫 ${t('skill_zone.lobby.void')}`
                                            : `⏳ ${t('skill_zone.lobby.pending')}`}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </div>

                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ================= LIVE AUCTIONS VIEW ================= */}
          {activeTab === 'auctions' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAuctions.length === 0 ? (
                <div className="col-span-3 text-center py-20 border border-dashed border-white/5 rounded-xl bg-[#14120b]/10">
                  <Hammer className="h-12 w-12 text-stone-500 mx-auto mb-3" />
                  <h3 className="font-bold text-white uppercase font-mono">{t('skill_zone.auctions.empty_title')}</h3>
                  <p className="text-xs text-stone-400 mt-1">{t('skill_zone.auctions.empty_text')}</p>
                </div>
              ) : (
                filteredAuctions.map(auc => {
                  const timeLeft = Math.max(0, Math.round((new Date(auc.endsAt) - Date.now()) / 1000));
                  const formatTimeRemaining = (seconds) => {
                    if (seconds <= 0) return t('skill_zone.auctions.time_ended');
                    const hrs = Math.floor(seconds / 3600);
                    const mins = Math.floor((seconds % 3600) / 60);
                    const secs = seconds % 60;
                    return t('skill_zone.auctions.time_format', { h: hrs, m: mins, s: secs });
                  };

                  return (
                    <div key={auc.id} className="bento-card border border-white/5 bg-[#14120b]/20 rounded-xl overflow-hidden hover:border-pink-500/30 transition-all duration-300 flex flex-col justify-between shadow-lg">
                      
                      {/* Image Header */}
                      <div className="h-48 relative bg-black">
                        <img 
                          src={normalizeImageUrl(auc.imageUrl)} 
                          alt={auc.title} 
                          className="w-full h-full object-cover opacity-85"
                        />
                        <div className="absolute top-2 left-2 flex flex-col space-y-1">
                          <span className="text-[9px] bg-black/80 text-pink-400 border border-pink-500/30 px-2 py-0.5 rounded font-bold font-mono">
                            {auc.condition}
                          </span>
                          <span className="text-[9px] bg-black/80 text-gold-400 border border-gold-500/30 px-2 py-0.5 rounded font-bold font-mono">
                            {t('skill_zone.auctions.value', { value: auc.marketValue })}
                          </span>
                        </div>

                        {/* Live Ticker Clock */}
                        <div className="absolute bottom-2 right-2 bg-black/80 px-2.5 py-1 rounded border border-red-500/30 text-pink-500 font-mono text-[10px] font-bold tracking-wider">
                          ⏳ {formatTimeRemaining(timeLeft)}
                        </div>
                      </div>

                      {/* Content Body */}
                      <div className="p-5 flex-1 flex flex-col justify-between">
                        <div>
                          <h3 className="text-base font-extrabold text-white leading-tight uppercase font-mono">{auc.title}</h3>
                          <p className="text-[10px] text-stone-400 mt-1 leading-snug">
                            {auc.description || t('skill_zone.auctions.description_fallback')}
                          </p>

                          <div className="grid grid-cols-2 gap-4 mt-5 bg-black/30 p-3 rounded-lg border border-white/5 font-mono text-center">
                            <div>
                              <div className="text-[9px] uppercase text-stone-400 leading-none">{t('skill_zone.auctions.current_bid')}</div>
                              <span className="text-gold-400 font-extrabold text-sm">{auc.currentBid} CR</span>
                            </div>
                            <div>
                              <div className="text-[9px] uppercase text-stone-400 leading-none">{t('skill_zone.auctions.instant_purchase')}</div>
                              <span className="text-gold-400 font-extrabold text-sm">{auc.buyNowPrice} CR</span>
                            </div>
                          </div>
                        </div>

                        {/* Bid placement inputs */}
                        <div className="mt-6 pt-4 border-t border-white/5 space-y-2">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handlePlaceBid(auc.id, auc.currentBid + 10)}
                              className="flex-1 py-2 border border-pink-500 hover:bg-pink-500/20 text-pink-400 hover:text-white rounded-lg font-bold font-mono text-[10px] uppercase transition-all duration-300 active-shrink"
                            >
                              {t('skill_zone.auctions.bid_10')}
                            </button>
                            <button
                              onClick={() => handlePlaceBid(auc.id, auc.currentBid + 50)}
                              className="flex-1 py-2 border border-pink-500 hover:bg-pink-500/20 text-pink-400 hover:text-white rounded-lg font-bold font-mono text-[10px] uppercase transition-all duration-300 active-shrink"
                            >
                              {t('skill_zone.auctions.bid_50')}
                            </button>
                          </div>

                          <button
                            onClick={() => handleDirectBuy(auc.productId)}
                            className="w-full py-2 bg-gold-500 hover:bg-gold-400 text-white font-extrabold rounded-lg font-mono text-xs uppercase tracking-wider transition-all duration-300 shadow-lg shadow-gold-500/15 active-shrink"
                          >
                            {t('skill_zone.auctions.buy_instantly', { price: auc.buyNowPrice })}
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}

          {/* ================= DEVELOPMENT DIAGNOSTICS CONTROL PANEL ================= */}
          <div className="mt-16 bento-card border border-white/5 border-dashed rounded-xl p-5 font-mono text-xs bg-[#14120b]/10">
            <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-3">
              <h3 className="font-extrabold text-white uppercase flex items-center space-x-2">
                <Layers className="h-4 w-4 text-gold-400" />
                <span>{t('skill_zone.diagnostics.title')}</span>
              </h3>
              <span className="text-[10px] bg-gold-950 border border-gold-500 text-gold-400 px-2 py-0.5 rounded font-bold">
                {t('skill_zone.diagnostics.badge')}
              </span>
            </div>

            <p className="text-[10px] text-stone-400 mb-4 leading-normal">
              {t('skill_zone.diagnostics.description')}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3 bg-black/40 rounded border border-white/5">
                <div className="font-bold text-gold-400 uppercase mb-1">{t('skill_zone.diagnostics.user_info_title')}</div>
                <p className="text-[10px] text-stone-500 mb-2">{t('skill_zone.diagnostics.user_info_text')}</p>
                <div className="text-[10px] font-semibold text-emerald-400 mb-2">
                  ✅ {t('skill_zone.diagnostics.logged_as')} <span className="text-white font-bold">{user.username}</span>
                </div>
                <button
                  onClick={() => setIsAdminFormOpen(!isAdminFormOpen)}
                  className="px-2.5 py-1 bg-white/5 hover:bg-gold-500 hover:text-white rounded text-[9px] uppercase font-bold transition-all block w-full text-center"
                >
                  {isAdminFormOpen ? t('skill_zone.diagnostics.close_puzzle_creator') : t('skill_zone.diagnostics.open_puzzle_creator')}
                </button>
              </div>

              <div className="p-3 bg-black/40 rounded border border-white/5">
                <div className="font-bold text-pink-400 uppercase mb-1">{t('skill_zone.diagnostics.buy_mock_title')}</div>
                <p className="text-[10px] text-stone-500 mb-2">{t('skill_zone.diagnostics.buy_mock_text')}</p>
                <button
                  onClick={() => navigate('/crediti/acquista?amount=50')}
                  className="px-3 py-1 bg-white/5 hover:bg-pink-500 hover:text-white rounded text-[10px] uppercase font-bold transition-all"
                >
                  {t('skill_zone.diagnostics.buy_mock_button')}
                </button>
              </div>

              <div className="p-3 bg-black/40 rounded border border-white/5">
                <div className="font-bold text-gold-400 uppercase mb-1">{t('skill_zone.diagnostics.reset_title')}</div>
                <p className="text-[10px] text-stone-500 mb-2">{t('skill_zone.diagnostics.reset_text')}</p>
                <button
                  onClick={() => {
                    fetchCatalogData();
                    triggerSystemSuccess(t('skill_zone.alerts.sync_success'));
                  }}
                  className="px-3 py-1 bg-white/5 hover:bg-gold-500 hover:text-white rounded text-[10px] uppercase font-bold transition-all flex items-center space-x-1"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  <span>{t('skill_zone.diagnostics.sync_button')}</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

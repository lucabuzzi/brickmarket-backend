import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import JigsawPuzzle from './components/JigsawPuzzle';
import {
  Trophy, Coins, ShieldAlert,
  Layers, Hammer, ChevronRight, Zap, RefreshCw, PlusCircle, CheckCircle, Flame
} from 'lucide-react';

export default function App() {
  // Authentication & Wallet State
  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState({ balanceCredits: 0.00 });
  const [authToken, setAuthToken] = useState(null);

  // App Layout States
  const [activeDivision, setActiveDivision] = useState('lego'); // lego | pokemon
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAddCredits, setShowAddCredits] = useState(false);
  const [activeTab, setActiveTab] = useState('lobby'); // lobby (contests) | auctions (live bids)
  
  // Auth Form State
  const [isLogin, setIsLogin] = useState(true);
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');

  // Stripe Simulation state
  const [creditAmount, setCreditAmount] = useState(10.00); // 10 Euros = 100 credits
  const [purchaseStatus, setPurchaseStatus] = useState('');

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
  const [isMockDb, setIsMockDb] = useState(false);

  // WebSockets Ref
  const wsRef = useRef(null);

  // Fetch all initial metadata
  const fetchCatalogData = async () => {
    try {
      // 1. Contests
      const contRes = await fetch('/api/contest/list');
      const contData = await contRes.json();
      if (contData.contests) setContests(contData.contests);

      // 2. Auctions
      const aucRes = await fetch('/api/auctions');
      const aucData = await aucRes.json();
      if (aucData.auctions) setAuctions(aucData.auctions);
    } catch (err) {
      console.error('Error loading catalogs:', err);
    }
  };

  // Fetch user wallet state
  const fetchWalletState = async (token) => {
    if (!token) return;
    try {
      const res = await fetch('/api/wallet/balance', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.balanceCredits !== undefined) {
        setWallet({
          balanceCredits: data.balanceCredits
        });
      }
    } catch (err) {
      console.error('Error fetching wallet:', err);
    }
  };

  // Re-fetch leaderboard for a contest
  const fetchLeaderboard = async (contestId) => {
    try {
      const res = await fetch(`/api/contest/leaderboard/${contestId}`);
      const data = await res.json();
      if (data.leaderboard) {
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
    const wsHost = window.location.hostname === 'localhost' ? 'localhost:5000' : window.location.host;
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
          triggerSystemAlert(`New high bid of ${currentBid} CR placed on auction!`);
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

    // Check for cached auth session
    const cachedToken = localStorage.getItem('cv_token');
    const cachedUser = localStorage.getItem('cv_user');
    if (cachedToken && cachedUser) {
      setAuthToken(cachedToken);
      setUser(JSON.parse(cachedUser));
      fetchWalletState(cachedToken);
    }
  }, []);

  // Poll catalogs every 10 seconds for timer countdown updates
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

  // JWT Signup / Login handlers
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    const url = isLogin ? '/api/auth/login' : '/api/auth/signup';

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      const data = await res.json();

      if (!res.ok) {
        setAuthError(data.error || 'Authentication failed');
        return;
      }

      localStorage.setItem('cv_token', data.token);
      localStorage.setItem('cv_user', JSON.stringify(data.user));
      setAuthToken(data.token);
      setUser(data.user);
      setShowAuthModal(false);
      triggerSystemSuccess(data.message);
      
      // Update wallet immediately
      fetchWalletState(data.token);
      fetchCatalogData();
    } catch (err) {
      setAuthError('Server connection lost');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('cv_token');
    localStorage.removeItem('cv_user');
    setAuthToken(null);
    setUser(null);
    setWallet({ balanceCredits: 0 });
    triggerSystemSuccess('Logged out successfully.');
  };

  // Simulated Stripe Checkout Payment webhook trigger
  const handleSimulatePayment = async () => {
    if (!user) return;
    setPurchaseStatus('Processing mock credit card...');

    try {
      const res = await fetch('/api/webhooks/simulate-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amountEuros: parseFloat(creditAmount)
        })
      });

      const data = await res.json();
      if (data.success) {
        setPurchaseStatus('Success! Credits deposited.');
        fetchWalletState(authToken);
        triggerSystemSuccess(data.message);
        setTimeout(() => {
          setShowAddCredits(false);
          setPurchaseStatus('');
        }, 1500);
      } else {
        setPurchaseStatus('Payment failed: ' + data.error);
      }
    } catch (err) {
      setPurchaseStatus('Error communicating with checkout server.');
    }
  };

  // Buy Slot Handler
  const handleBuySlot = async (contestId) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    try {
      const res = await fetch('/api/contest/buy-slot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ contestId })
      });

      const data = await res.json();
      if (!res.ok) {
        triggerSystemAlert(data.error || 'Failed to buy slot');
        return;
      }

      fetchWalletState(authToken);
      fetchCatalogData();
      fetchLeaderboard(contestId);
      triggerSystemSuccess(data.message);
    } catch (err) {
      triggerSystemAlert('Network error joining contest.');
    }
  };

  // Start attempt handler (Anti-cheat JWT)
  const handleStartAttempt = async (contestId) => {
    try {
      const res = await fetch('/api/contest/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ contestId })
      });

      const data = await res.json();
      if (!res.ok) {
        triggerSystemAlert(data.error || 'Failed to start attempt');
        return;
      }

      const contestDetails = contests.find(c => c.id === contestId);
      setPlayingContest(contestDetails);
      setAttemptToken(data.attemptToken);
      setGameResult(null);
    } catch (err) {
      triggerSystemAlert('Server error starting puzzle.');
    }
  };

  // Complete attempt handler
  const handleCompleteAttempt = async ({ contestId, attemptToken, blurCount, totalBlurTimeMs }) => {
    try {
      const res = await fetch('/api/contest/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          contestId,
          attemptToken,
          blurCount,
          totalBlurTimeMs
        })
      });

      const data = await res.json();
      setGameResult(data);
      fetchWalletState(authToken);
      fetchCatalogData();
      fetchLeaderboard(contestId);
    } catch (err) {
      triggerSystemAlert('Error submitting puzzle scores.');
    }
  };

  // Place Bid on Auction
  const handlePlaceBid = async (auctionId, bidAmount) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    try {
      const res = await fetch('/api/auctions/bid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ auctionId, bidAmount })
      });

      const data = await res.json();
      if (!res.ok) {
        triggerSystemAlert(data.error || 'Failed to place bid');
        return;
      }

      fetchWalletState(authToken);
      fetchCatalogData();
      triggerSystemSuccess(data.message);
    } catch (err) {
      triggerSystemAlert('Error submitting bid.');
    }
  };

  // Direct Buy Checkout (used by the auctions "Buy Instantly" action)
  const handleDirectBuy = async (productId) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    try {
      const res = await fetch('/api/wallet/buy-product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ productId })
      });

      const data = await res.json();
      if (!res.ok) {
        triggerSystemAlert(data.error || 'Direct purchase failed');
        return;
      }

      fetchWalletState(authToken);
      fetchCatalogData();
      triggerSystemSuccess(data.message);
    } catch (err) {
      triggerSystemAlert('Server connection error during purchase.');
    }
  };

  // Segment catalogs by category (LEGO vs Pokémon)
  const filteredContests = contests.filter(c => c.category === activeDivision);
  const filteredAuctions = auctions.filter(a => a.category === activeDivision);

  return (
    <div className="min-h-screen pb-16">
      {/* Global Alerts */}
      {sysAlert && (
        <div className="fixed right-6 top-20 z-50 flex items-center space-x-3 rounded-lg border border-red-500 bg-red-950/90 p-4 text-red-300 shadow-lg backdrop-blur-md animate-slide-in">
          <ShieldAlert className="h-5 w-5 text-red-400" />
          <span className="font-mono text-xs font-bold uppercase">{sysAlert}</span>
        </div>
      )}
      {sysSuccess && (
        <div className="fixed right-6 top-20 z-50 flex items-center space-x-3 rounded-lg border border-cyber-neonGreen bg-green-950/90 p-4 text-green-300 shadow-lg backdrop-blur-md animate-slide-in">
          <CheckCircle className="h-5 w-5 text-cyber-neonGreen" />
          <span className="font-mono text-xs font-bold uppercase">{sysSuccess}</span>
        </div>
      )}

      {/* Header Navbar */}
      <Navbar 
        user={user} 
        wallet={wallet} 
        onLogout={handleLogout} 
        onShowAuthModal={() => setShowAuthModal(true)} 
        onShowAddCredits={() => setShowAddCredits(true)}
        activeDivision={activeDivision}
        setActiveDivision={setActiveDivision}
      />

      {/* Main Container */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Play Area Overlay Panel */}
        {playingContest ? (
          <div className="glass-panel border-cyber-neonCyan/30 rounded-xl p-6 mb-8 relative">
            <div className="absolute top-4 right-4 z-20">
              <span className="inline-flex items-center text-[10px] uppercase font-mono font-bold bg-cyan-950 border border-cyber-neonCyan text-cyber-neonCyan px-2.5 py-1 rounded">
                ⚡ SECURE ARCADE ROOM
              </span>
            </div>

            <div className="text-center mb-6">
              <h2 className="text-xl font-extrabold tracking-wide uppercase text-white font-mono">
                Skill Zone: {playingContest.title}
              </h2>
              <p className="text-xs text-cyber-muted mt-1">
                A 50-piece HTML5 canvas puzzle attempt. Finish as fast as possible. tab out or cheat triggers will disqualify your attempt.
              </p>
            </div>

            {gameResult ? (
              <div className="flex flex-col items-center justify-center py-12 text-center max-w-md mx-auto">
                {gameResult.status === 'cheated' ? (
                  <>
                    <ShieldAlert className="h-16 w-16 text-cyber-neonMagenta mb-4 animate-pulse" />
                    <h3 className="text-xl font-bold text-cyber-neonMagenta uppercase tracking-wider">Attempt Voided</h3>
                    <p className="text-xs text-cyber-muted mt-2 mb-6">
                      The anti-cheat verified your time as humanly impossible or registered window blur triggers. Score was not added to leaderboard.
                    </p>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-16 w-16 text-cyber-neonGreen mb-4" />
                    <h3 className="text-xl font-bold text-cyber-neonGreen uppercase tracking-wider">Submission Completed</h3>
                    <p className="text-sm font-mono text-white font-bold mt-2">
                      Elapsed Time: {(gameResult.timeMs / 1000).toFixed(2)}s
                    </p>
                    {gameResult.contestFinalized ? (
                      <div className="mt-4 p-3 bg-cyber-accent/20 border border-cyber-accent rounded text-xs text-cyber-text">
                        🎉 Contest Finalized! Winner: <span className="font-extrabold text-cyber-neonYellow">{gameResult.winnerName}</span>.
                      </div>
                    ) : (
                      <p className="text-xs text-cyber-muted mt-2 mb-6">
                        Attempt successfully logged! Waiting for other slot participants to finish.
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
                  className="px-6 py-2 bg-cyber-neonCyan text-black hover:bg-white rounded font-bold font-mono text-xs uppercase tracking-wider transition-all duration-300 shadow-neon-cyan"
                >
                  Return to Arena Lobby
                </button>
              </div>
            ) : (
              <JigsawPuzzle 
                imageUrl={playingContest.imageUrl}
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
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-cyber-border pb-4 mb-8 space-y-4 md:space-y-0">
          <div className="flex space-x-1 p-1 bg-black/40 rounded-lg border border-cyber-border max-w-sm">
            <button
              onClick={() => setActiveTab('lobby')}
              className={`flex items-center space-x-1.5 px-4 py-2 rounded-md text-xs font-bold uppercase transition-all duration-300 ${
                activeTab === 'lobby'
                  ? 'bg-cyber-accent text-white shadow-neon-magenta'
                  : 'text-cyber-muted hover:text-white'
              }`}
            >
              <Trophy className="h-3.5 w-3.5" />
              <span>Skill Zone</span>
            </button>
            <button
              onClick={() => setActiveTab('auctions')}
              className={`flex items-center space-x-1.5 px-4 py-2 rounded-md text-xs font-bold uppercase transition-all duration-300 ${
                activeTab === 'auctions'
                  ? 'bg-cyber-accent text-white shadow-neon-magenta'
                  : 'text-cyber-muted hover:text-white'
              }`}
            >
              <Hammer className="h-3.5 w-3.5" />
              <span>Live Auctions</span>
            </button>
          </div>

          <div className="flex items-center space-x-3 text-xs text-cyber-muted font-mono bg-black/20 px-3 py-1.5 rounded-lg border border-cyber-border">
            <span className="flex h-2 w-2 rounded-full bg-cyber-neonGreen animate-ping"></span>
            <span>Real-time Connection: <span className="text-white font-bold">ONLINE</span></span>
          </div>
        </div>

        {/* ================= SKILL ZONE LOBBY ================= */}
        {activeTab === 'lobby' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {filteredContests.length === 0 ? (
              <div className="col-span-2 text-center py-20 border border-dashed border-cyber-border rounded-xl">
                <Trophy className="h-12 w-12 text-cyber-muted mx-auto mb-3" />
                <h3 className="font-bold text-white uppercase font-mono">No contests active</h3>
                <p className="text-xs text-cyber-muted mt-1">There are currently no active Skill Rooms in this division.</p>
              </div>
            ) : (
              filteredContests.map(con => {
                const isParticipating = leaderboards[con.id]?.some(p => p.userId === user?.id);
                const hasPlayed = leaderboards[con.id]?.some(p => p.userId === user?.id && p.status !== 'pending');
                const slotsRemaining = con.totalSlots - con.filledSlots;

                return (
                  <div key={con.id} className="glass-panel border-cyber-border rounded-xl overflow-hidden hover:border-cyber-neonCyan/40 transition-all duration-300 flex flex-col md:flex-row">
                    
                    {/* Image Block */}
                    <div className="w-full md:w-48 h-48 md:h-auto relative flex-shrink-0 bg-black">
                      <img 
                        src={con.imageUrl} 
                        alt={con.title} 
                        className="w-full h-full object-cover opacity-80"
                      />
                      <div className="absolute top-2 left-2 flex flex-col space-y-1">
                        <span className="text-[9px] bg-black/80 text-cyber-neonCyan border border-cyber-neonCyan/30 px-2 py-0.5 rounded font-bold font-mono">
                          VALUE: {con.marketValue} CR
                        </span>
                        <span className="text-[9px] bg-black/80 text-cyber-neonMagenta border border-cyber-neonMagenta/30 px-2 py-0.5 rounded font-bold font-mono">
                          {con.condition}
                        </span>
                      </div>
                    </div>

                    {/* Content Block */}
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="text-base font-extrabold text-white leading-tight uppercase font-mono truncate max-w-[280px]">
                          {con.title}
                        </h3>
                        <p className="text-[10px] text-cyber-muted mt-1 leading-snug">
                          {con.gradingInfo || "Premium collectible condition."}
                        </p>

                        {/* Slots Progress Bar */}
                        <div className="mt-4">
                          <div className="flex justify-between items-center text-[10px] font-mono text-cyber-muted mb-1">
                            <span>Arena Slots Filled</span>
                            <span className="text-white font-bold">{con.filledSlots} / {con.totalSlots}</span>
                          </div>
                          <div className="w-full h-2 bg-black/50 rounded overflow-hidden">
                            <div 
                              className="h-full bg-cyber-neonCyan shadow-neon-cyan transition-all duration-300"
                              style={{ width: `${(con.filledSlots / con.totalSlots) * 100}%` }}
                            ></div>
                          </div>
                          <div className="flex justify-between items-center mt-1 text-[8px] font-mono">
                            <span className="text-cyber-muted uppercase">Cost to Enter:</span>
                            <span className="text-cyber-neonYellow text-glow-yellow font-bold text-[10px]">{con.slotCostCredits} CR</span>
                          </div>
                        </div>
                      </div>

                      {/* Entry and gameplay controls */}
                      <div className="mt-6 pt-4 border-t border-cyber-border/40 flex items-center justify-between">
                        {isParticipating ? (
                          hasPlayed ? (
                            <span className="inline-flex items-center space-x-1 text-[10px] text-cyber-neonGreen font-mono uppercase bg-green-950/20 px-3 py-1.5 border border-cyber-neonGreen/30 rounded">
                              <CheckCircle className="h-3 w-3" />
                              <span>Attempt Logged</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => handleStartAttempt(con.id)}
                              className="w-full py-2 bg-cyber-neonGreen text-black font-extrabold rounded font-mono text-xs uppercase tracking-wider hover:bg-white transition-all duration-300 shadow-neon-green"
                            >
                              🕹️ Launch Jigsaw
                            </button>
                          )
                        ) : con.status === 'open' ? (
                          <button
                            onClick={() => handleBuySlot(con.id)}
                            className="w-full py-2 bg-cyber-neonCyan hover:bg-white text-black font-extrabold rounded font-mono text-xs uppercase tracking-wider transition-all duration-300 shadow-neon-cyan"
                          >
                            Buy Entry Slot
                          </button>
                        ) : (
                          <span className="inline-flex items-center text-[10px] text-cyber-muted font-mono uppercase bg-black/40 px-3 py-1.5 rounded">
                            Contest Active / Full
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Leaderboard panel inside card */}
                    <div className="w-full md:w-56 bg-black/40 p-4 border-t md:border-t-0 md:border-l border-cyber-border/50 font-mono">
                      <div className="flex items-center justify-between text-[10px] uppercase font-bold text-cyber-muted pb-2 border-b border-cyber-border/30 mb-2">
                        <span>Leaderboard</span>
                        <Trophy className="h-3 w-3 text-cyber-neonYellow" />
                      </div>
                      <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                        {leaderboards[con.id]?.length === 0 || !leaderboards[con.id] ? (
                          <div className="text-[9px] text-cyber-muted text-center py-4">No attempts recorded</div>
                        ) : (
                          leaderboards[con.id].map((ld, i) => (
                            <div key={ld.id} className="flex justify-between items-center text-[10px] py-1 border-b border-cyber-border/10">
                              <div className="flex items-center space-x-1 truncate max-w-[120px]">
                                <span className={`font-bold ${i === 0 ? 'text-cyber-neonYellow' : 'text-cyber-muted'}`}>{i + 1}.</span>
                                <span className="font-semibold">{ld.username}</span>
                              </div>
                              <span className="font-semibold text-cyber-neonCyan">
                                {ld.status === 'completed' 
                                  ? `${(ld.totalTimeMs / 1000).toFixed(2)}s` 
                                  : ld.status === 'cheated' 
                                    ? '🚫 VOID' 
                                    : '⏳ pending'}
                              </span>
                            </div>
                          ))
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
              <div className="col-span-3 text-center py-20 border border-dashed border-cyber-border rounded-xl">
                <Hammer className="h-12 w-12 text-cyber-muted mx-auto mb-3" />
                <h3 className="font-bold text-white uppercase font-mono">No live auctions</h3>
                <p className="text-xs text-cyber-muted mt-1">Check back later for active collectible auction drops.</p>
              </div>
            ) : (
              filteredAuctions.map(auc => {
                const timeLeft = Math.max(0, Math.round((new Date(auc.endsAt) - Date.now()) / 1000));
                const formatTimeRemaining = (seconds) => {
                  if (seconds <= 0) return 'ENDED';
                  const hrs = Math.floor(seconds / 3600);
                  const mins = Math.floor((seconds % 3600) / 60);
                  const secs = seconds % 60;
                  return `${hrs}h ${mins}m ${secs}s`;
                };

                return (
                  <div key={auc.id} className="glass-panel border-cyber-border rounded-xl overflow-hidden hover:border-cyber-neonMagenta/40 transition-all duration-300 flex flex-col justify-between">
                    
                    {/* Image Header */}
                    <div className="h-48 relative bg-black">
                      <img 
                        src={auc.imageUrl} 
                        alt={auc.title} 
                        className="w-full h-full object-cover opacity-85"
                      />
                      <div className="absolute top-2 left-2 flex flex-col space-y-1">
                        <span className="text-[9px] bg-black/80 text-cyber-neonMagenta border border-cyber-neonMagenta/30 px-2 py-0.5 rounded font-bold font-mono">
                          {auc.condition}
                        </span>
                        <span className="text-[9px] bg-black/80 text-cyber-neonCyan border border-cyber-neonCyan/30 px-2 py-0.5 rounded font-bold font-mono">
                          VAL: {auc.marketValue} CR
                        </span>
                      </div>

                      {/* Live Ticker Clock */}
                      <div className="absolute bottom-2 right-2 bg-black/80 px-2.5 py-1 rounded border border-red-500/30 text-cyber-neonMagenta font-mono text-[10px] font-bold tracking-wider">
                        ⏳ {formatTimeRemaining(timeLeft)}
                      </div>
                    </div>

                    {/* Content Body */}
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="text-base font-extrabold text-white leading-tight uppercase font-mono">{auc.title}</h3>
                        <p className="text-[10px] text-cyber-muted mt-1 leading-snug">
                          {auc.gradingInfo || "PSA Graded High-Grade Collectible Card."}
                        </p>

                        <div className="grid grid-cols-2 gap-4 mt-5 bg-black/30 p-3 rounded-lg border border-cyber-border/40 font-mono text-center">
                          <div>
                            <div className="text-[9px] uppercase text-cyber-muted leading-none">Current Bid</div>
                            <span className="text-cyber-neonYellow text-glow-yellow font-extrabold text-sm">{auc.currentBid} CR</span>
                          </div>
                          <div>
                            <div className="text-[9px] uppercase text-cyber-muted leading-none">Instant Purchase</div>
                            <span className="text-cyber-neonCyan text-glow-cyan font-extrabold text-sm">{auc.buyNowPrice} CR</span>
                          </div>
                        </div>
                      </div>

                      {/* Bid placement inputs */}
                      <div className="mt-6 pt-4 border-t border-cyber-border/40 space-y-2">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handlePlaceBid(auc.id, auc.currentBid + 10)}
                            className="flex-1 py-2 border border-cyber-neonMagenta hover:bg-cyber-neonMagenta/20 text-cyber-neonMagenta hover:text-white rounded font-bold font-mono text-[10px] uppercase transition-all duration-300"
                          >
                            +10 CR Bid
                          </button>
                          <button
                            onClick={() => handlePlaceBid(auc.id, auc.currentBid + 50)}
                            className="flex-1 py-2 border border-cyber-neonMagenta hover:bg-cyber-neonMagenta/20 text-cyber-neonMagenta hover:text-white rounded font-bold font-mono text-[10px] uppercase transition-all duration-300"
                          >
                            +50 CR Bid
                          </button>
                        </div>
                        
                        <button
                          onClick={() => handleDirectBuy(auc.productId)}
                          className="w-full py-2 bg-cyber-neonCyan hover:bg-white text-black font-extrabold rounded font-mono text-xs uppercase tracking-wider transition-all duration-300 shadow-neon-cyan"
                        >
                          Buy Instantly ({auc.buyNowPrice} CR)
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ================= AUTHENTICATION MODAL ================= */}
        {showAuthModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
            <div className="glass-panel border-cyber-neonCyan/40 w-full max-w-md rounded-xl p-6 relative">
              <button 
                onClick={() => setShowAuthModal(false)}
                className="absolute top-4 right-4 text-cyber-muted hover:text-white font-mono text-sm"
              >
                [X]
              </button>

              <h2 className="text-xl font-extrabold text-white uppercase font-mono text-center mb-6">
                {isLogin ? '🔒 CLUTCHVAULT GATEWAY' : '🧬 REGISTER PROFILE'}
              </h2>

              {authError && (
                <div className="p-3 bg-red-950/40 border border-red-500 rounded text-red-300 text-xs font-mono mb-4 text-center">
                  ⚠️ {authError}
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-4 font-mono text-xs">
                {!isLogin && (
                  <div>
                    <label className="block text-cyber-muted uppercase font-bold mb-1">Username</label>
                    <input 
                      type="text" 
                      value={authForm.username}
                      onChange={e => setAuthForm(prev => ({ ...prev, username: e.target.value }))}
                      className="w-full bg-black/40 border border-cyber-border rounded px-3 py-2 text-white outline-none focus:border-cyber-neonCyan"
                      placeholder="e.g. CardCollector99"
                      required
                    />
                  </div>
                )}
                <div>
                  <label className="block text-cyber-muted uppercase font-bold mb-1">Email Address</label>
                  <input 
                    type="email" 
                    value={authForm.email}
                    onChange={e => setAuthForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full bg-black/40 border border-cyber-border rounded px-3 py-2 text-white outline-none focus:border-cyber-neonCyan"
                    placeholder="name@clutchvault.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-cyber-muted uppercase font-bold mb-1">Secret Key / Password</label>
                  <input 
                    type="password" 
                    value={authForm.password}
                    onChange={e => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full bg-black/40 border border-cyber-border rounded px-3 py-2 text-white outline-none focus:border-cyber-neonCyan"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-cyber-neonCyan hover:bg-white text-black font-extrabold rounded uppercase tracking-wider transition-all duration-300 mt-6 shadow-neon-cyan text-xs"
                >
                  {isLogin ? 'Establish Handshake' : 'Initialize Account'}
                </button>
              </form>

              <div className="text-center mt-6 text-[10px] font-mono text-cyber-muted">
                {isLogin ? "No vault key yet?" : "Already registered?"}{' '}
                <button
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-cyber-neonMagenta font-bold hover:underline ml-1"
                >
                  {isLogin ? 'Create Profile' : 'Authenticate Here'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= CREDIT RECHARGE MODAL (Stripe Webhook simulation) ================= */}
        {showAddCredits && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
            <div className="glass-panel border-cyber-neonMagenta/40 w-full max-w-md rounded-xl p-6 relative font-mono text-xs">
              <button 
                onClick={() => {
                  setShowAddCredits(false);
                  setPurchaseStatus('');
                }}
                className="absolute top-4 right-4 text-cyber-muted hover:text-white text-sm"
              >
                [X]
              </button>

              <h2 className="text-xl font-extrabold text-white uppercase text-center mb-6">
                💳 Wallet Balance Portal
              </h2>

              <p className="text-[10px] text-cyber-muted mb-4 text-center leading-normal">
                ClutchVault runs on a secure credit system. 
                Purchasing credits triggers a standard webhook transaction converting Euros into credits.
              </p>

              <div className="bg-black/50 p-4 rounded-lg border border-cyber-border mb-6">
                <label className="block text-cyber-muted uppercase font-bold mb-2">Recharge Amount (Euros)</label>
                <div className="flex items-center space-x-2">
                  <select 
                    value={creditAmount}
                    onChange={e => setCreditAmount(parseFloat(e.target.value))}
                    className="flex-1 bg-black/40 border border-cyber-border rounded px-3 py-2 text-white outline-none focus:border-cyber-neonMagenta text-sm font-bold"
                  >
                    <option value="10.00">€10.00 (100 credits)</option>
                    <option value="25.00">€25.00 (250 credits)</option>
                    <option value="50.00">€50.00 (500 credits)</option>
                    <option value="100.00">€100.00 (1,000 credits)</option>
                  </select>
                </div>
              </div>

              {purchaseStatus && (
                <div className="p-3 bg-black/50 border border-cyber-border rounded text-cyber-neonCyan text-center mb-4 font-bold text-[10px]">
                  ⏳ {purchaseStatus}
                </div>
              )}

              <button
                onClick={handleSimulatePayment}
                className="w-full py-2 bg-cyber-neonMagenta hover:bg-white hover:text-black text-white font-extrabold rounded uppercase tracking-wider transition-all duration-300 shadow-neon-magenta text-xs"
              >
                Simulate Stripe Purchase
              </button>
            </div>
          </div>
        )}

        {/* ================= DEVELOPMENT DIAGNOSTICS CONTROL PANEL ================= */}
        <div className="mt-16 glass-panel border-dashed border-cyber-border rounded-xl p-5 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-cyber-border pb-3 mb-3">
            <h3 className="font-extrabold text-white uppercase flex items-center space-x-2">
              <Layers className="h-4 w-4 text-cyber-neonYellow" />
              <span>Diagnostic & Sandbox Controls</span>
            </h3>
            <span className="text-[10px] bg-yellow-950 border border-yellow-500 text-yellow-400 px-2 py-0.5 rounded font-bold">
              DEVELOPER SANDBOX
            </span>
          </div>

          <p className="text-[10px] text-cyber-muted mb-4 leading-normal">
            This dashboard lets you test the ledger locking, Stripe webhooks, and the anti-cheat jigsaw engine safely. 
            If you did not configure Supabase database environment variables, the backend is running in **Mock DB mode** (all actions save in local Express memory).
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-3 bg-black/40 rounded border border-cyber-border">
              <div className="font-bold text-cyber-neonCyan uppercase mb-1">1. Setup Auth State</div>
              <p className="text-[10px] text-cyber-muted mb-2">Login or sign up to interact with credits & wallet ledger.</p>
              {user ? (
                <div className="text-[10px] font-semibold text-cyber-neonGreen">
                  ✅ Authenticated as: <span className="text-white">{user.username}</span>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setIsLogin(true);
                    setShowAuthModal(true);
                  }}
                  className="px-3 py-1 bg-cyber-border hover:bg-cyber-neonCyan hover:text-black rounded text-[10px] uppercase font-bold"
                >
                  Quick Authenticate
                </button>
              )}
            </div>

            <div className="p-3 bg-black/40 rounded border border-cyber-border">
              <div className="font-bold text-cyber-neonMagenta uppercase mb-1">2. Buy Mock Coins</div>
              <p className="text-[10px] text-cyber-muted mb-2">Simulates Stripe checkout callback. Depositing credits into double-entry ledger.</p>
              <button
                disabled={!user}
                onClick={() => {
                  setCreditAmount(50.00);
                  setShowAddCredits(true);
                }}
                className={`px-3 py-1 bg-cyber-border hover:bg-cyber-neonMagenta hover:text-white rounded text-[10px] uppercase font-bold ${!user && 'opacity-40 cursor-not-allowed'}`}
              >
                +500 Credits (Simulate €50)
              </button>
            </div>

            <div className="p-3 bg-black/40 rounded border border-cyber-border">
              <div className="font-bold text-cyber-neonYellow uppercase mb-1">3. Live Reset</div>
              <p className="text-[10px] text-cyber-muted mb-2">Reload catalogs, refresh states, and update leaderboard listings.</p>
              <button
                onClick={() => {
                  fetchCatalogData();
                  triggerSystemSuccess('Database connections synchronized!');
                }}
                className="px-3 py-1 bg-cyber-border hover:bg-cyber-neonYellow hover:text-black rounded text-[10px] uppercase font-bold flex items-center space-x-1"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                <span>Sync Core API</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

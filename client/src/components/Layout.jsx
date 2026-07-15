import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { apiUrl } from '../api';
import { Menu, X, Key, ShoppingCart, Search, BookOpen } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useTranslation } from 'react-i18next';
import NotificationBell from './NotificationBell';

const LegoHeadIcon = ({ size = 16, color = "currentColor", strokeWidth = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 3h8v2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2V3z" />
    <circle cx="9" cy="12" r="1.5" fill={color} stroke="none" />
    <circle cx="15" cy="12" r="1.5" fill={color} stroke="none" />
    <path d="M10 16c.6.4 1.4.6 2 .6s1.4-.2 2-.6" />
  </svg>
);

const LANGUAGES = [
  { code: 'it', name: 'ITALIANO', flag: 'fi fi-it' },
  { code: 'en', name: 'ENGLISH', flag: 'fi fi-gb' },
  { code: 'de', name: 'DEUTSCH', flag: 'fi fi-de' },
  { code: 'es', name: 'ESPAÑOL', flag: 'fi fi-es' },
  { code: 'fr', name: 'FRANÇAIS', flag: 'fi fi-fr' },
];

export default function Layout() {
  const { user, login, logout } = useAuth();
  const { cart, cartIsAnimating } = useCart();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [apiStatus, setApiStatus] = useState('checking');

  // Quick Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // User Menu State
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const userDropdownRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    function handleClickOutside(event) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  // Toast Notification State
  const [toastNotif, setToastNotif] = useState(null);

  const handleNewNotification = (notif) => {
    setToastNotif(notif);
    setTimeout(() => setToastNotif(null), 5000); // auto clear after 5s
  };

  // Global topbar search
  const [searchParams]   = useSearchParams();
  const [topbarQuery, setTopbarQuery] = useState('');
  const topbarInputRef   = useRef(null);

  useEffect(() => {
    if (location.pathname === '/search-results') {
      setTopbarQuery(searchParams.get('q') || '');
    } else {
      setTopbarQuery('');
    }
  }, [location.pathname, searchParams]);

  const handleTopbarSearch = (e) => {
    e.preventDefault();
    const q = topbarQuery.trim();
    if (!q) return;
    navigate(`/search-results?q=${encodeURIComponent(q)}`);
  };

  const [isMenuOpen, setIsMenuOpen] = useState(false);


  useEffect(() => {
    let cancelled = false;
    async function checkApi() {
      try {
        const res = await fetch(apiUrl('/health'), { cache: 'no-store' });
        if (!cancelled) setApiStatus(res.ok ? 'online' : 'offline');
      } catch {
        if (!cancelled) setApiStatus('offline');
      }
    }
    checkApi();
    const id = setInterval(checkApi, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const handleQuickLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    try {
      await login(loginEmail, loginPassword);
      setLoginEmail('');
      setLoginPassword('');
    } catch (err) {
      setLoginError(t('errors.invalid_credentials'));
    } finally {
      setLoggingIn(false);
    }
  };


  const currentLang = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0];

  return (
    <div className="app-shell" style={{ overflowX: 'hidden', position: 'relative' }}>
      {isMenuOpen && (
        <div 
          onClick={() => setIsMenuOpen(false)}
          className="fixed inset-0 bg-black/65 backdrop-blur-[2px] z-40 transition-opacity duration-300"
        />
      )}

      {/* Drawer */}
      {isMenuOpen && (
        <div 
          className="fixed top-0 right-0 bottom-0 w-[320px] glass-effect-strong z-50 flex flex-col shadow-2xl shadow-black/60 animate-[slideInRight_0.3s_ease-out]"
          style={{ borderRight: 'none' }}
        >
           <div style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'flex-end', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', height: '73px', alignItems: 'center' }}>
             <button onClick={() => setIsMenuOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
               <X size={28} />
             </button>
           </div>

         <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
           <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
             <Link to="/catalog" style={{ color: '#e2e8f0', textDecoration: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.75rem' }} onClick={() => setIsMenuOpen(false)}>
               <BookOpen size={20} className="text-sky-400" /> {t('nav.catalog')}
             </Link>
             <Link to="/annunci" style={{ color: '#e2e8f0', textDecoration: 'none', fontWeight: 'bold' }} onClick={() => setIsMenuOpen(false)}>{t('nav.listings')}</Link>
             <Link to="/aste" style={{ color: '#e2e8f0', textDecoration: 'none', fontWeight: 'bold' }} onClick={() => setIsMenuOpen(false)}>{t('nav.auctions')}</Link>
             <Link to="/ricerca-utente" style={{ color: '#e2e8f0', textDecoration: 'none', fontWeight: 'bold' }} onClick={() => setIsMenuOpen(false)}>{t('nav.user_search')}</Link>
             <Link to="/norme-legali" style={{ color: '#e2e8f0', textDecoration: 'none', fontWeight: 'bold' }} onClick={() => setIsMenuOpen(false)}>{t('nav.legal_rules')}</Link>
             <Link to="/terms" style={{ color: '#e2e8f0', textDecoration: 'none', fontWeight: 'bold' }} onClick={() => setIsMenuOpen(false)}>{t('nav.terms')}</Link>
             <Link to="/help" style={{ color: '#e2e8f0', textDecoration: 'none', fontWeight: 'bold' }} onClick={() => setIsMenuOpen(false)}>{t('nav.help')}</Link>
             <Link to="/faq" style={{ color: '#e2e8f0', textDecoration: 'none', fontWeight: 'bold' }} onClick={() => setIsMenuOpen(false)}>{t('nav.faq')}</Link>
             <Link to="/jobs" style={{ color: '#e2e8f0', textDecoration: 'none', fontWeight: 'bold' }} onClick={() => setIsMenuOpen(false)}>{t('nav.jobs')}</Link>
             
             {!user ? (
               <>
                 <Link to="/login" style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 'bold' }} onClick={() => setIsMenuOpen(false)}>{t('nav.login')}</Link>
                 <Link to="/register" style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 'bold' }} onClick={() => setIsMenuOpen(false)}>{t('nav.register')}</Link>
               </>
             ) : (user.role === 'seller' || user.role === 'both') ? (
               <>
                 <Link to="/sell" style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 'bold' }} onClick={() => setIsMenuOpen(false)}>{t('nav.sell')}</Link>
                 <Link to="/create-auction" style={{ color: '#fbbf24', textDecoration: 'none', fontWeight: 'bold' }} onClick={() => setIsMenuOpen(false)}>{t('nav.new_auction')}</Link>
               </>
             ) : null}

             {user && user.role === 'admin' && (
               <Link to="/admin" style={{ color: '#10b981', textDecoration: 'none', fontWeight: 'bold' }} onClick={() => setIsMenuOpen(false)}>{t('nav.admin_panel')}</Link>
             )}
           </div>
           
           <hr style={{ border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.05)', margin: '0 -1.5rem 1.5rem -1.5rem' }} />


           {/* Language Selector Section */}
           <div style={{ marginBottom: '2rem' }}>
             <h4 style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '1rem', letterSpacing: '1px' }}>{t('ui.language')}</h4>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
               {LANGUAGES.map((lang) => (
                 <button 
                   key={lang.code}
                   onClick={() => {
                     i18n.changeLanguage(lang.code);
                     setIsMenuOpen(false);
                   }}
                   style={{ 
                     display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 1rem', borderRadius: '8px', 
                     backgroundColor: i18n.language === lang.code ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                     border: i18n.language === lang.code ? '1px solid #38bdf8' : '1px solid transparent',
                     cursor: 'pointer', color: i18n.language === lang.code ? '#38bdf8' : '#e2e8f0',
                     transition: 'all 0.2s', textAlign: 'left'
                   }}
                   className="lang-option"
                 >
                   <span className={lang.flag} style={{ borderRadius: '2px' }}></span>
                   <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{lang.name}</span>
                 </button>
               ))}
             </div>
             
             {/* Disclaimer Note */}
             <div style={{ marginTop: '1.25rem', padding: '0.75rem', backgroundColor: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.75rem', lineHeight: '1.4', fontStyle: 'italic', fontWeight: '400' }}>
                  {t('disclaimer.language_note')}
                </p>
             </div>
           </div>

           <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
             <a href="#" onClick={() => setIsMenuOpen(false)} style={{ color: '#94a3b8', fontSize: '0.8rem', textDecoration: 'none', fontFamily: 'monospace', fontWeight: '600' }}>@brickmarket<span style={{ color: '#38bdf8' }}>news</span></a>
             <a href="#" onClick={() => setIsMenuOpen(false)} style={{ color: '#94a3b8', fontSize: '0.8rem', textDecoration: 'none', fontFamily: 'monospace', fontWeight: '600' }}>@brickmarket<span style={{ color: '#38bdf8' }}>spoilers</span></a>
             <a href="#" onClick={() => setIsMenuOpen(false)} style={{ color: '#94a3b8', fontSize: '0.8rem', textDecoration: 'none', fontFamily: 'monospace', fontWeight: '600' }}>@brickmarket<span style={{ color: '#38bdf8' }}>insight</span></a>
             <a href="#" onClick={() => setIsMenuOpen(false)} style={{ color: '#94a3b8', fontSize: '0.8rem', textDecoration: 'none', fontFamily: 'monospace', fontWeight: '600' }}>@brickmarket<span style={{ color: '#d946ef' }}>sponsorship</span></a>
           </div>

         </div>
      </div>
      )}

      <header className="fixed top-0 left-0 right-0 h-16 bg-[#070913]/60 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-4 z-[60] shadow-lg shadow-black/25">
        {/* Left: Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center shadow-lg shadow-red-900/20">
            <LegoHeadIcon size={20} color="white" />
          </div>
          <span className="hidden min-[400px]:block text-lg font-black tracking-tighter text-white">
            BrickMarket
          </span>
        </Link>

        {/* Center: Search (Desktop only) */}
        <form onSubmit={handleTopbarSearch} className="hidden lg:flex flex-1 max-w-[400px] relative mx-8">
          <input
            ref={topbarInputRef}
            type="text"
            value={topbarQuery}
            onChange={e => setTopbarQuery(e.target.value)}
            placeholder={t('ui.search_placeholder')}
            className="w-full px-4 py-1.5 pr-10 text-sm rounded-full border border-white/10 bg-[#0d1224]/50 text-white outline-none focus:border-sky-500 transition-all backdrop-blur-md"
          />
          <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-sky-400">
            <Search size={16} strokeWidth={3} />
          </button>
        </form>

        {/* Right: Actions */}
        <div className="flex items-center gap-1 min-[350px]:gap-2 md:gap-4">
          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-6 mr-4 border-r border-white/5 pr-6">
            <NavLink to="/" end className={({ isActive }) => `text-xs font-bold uppercase tracking-wider transition-colors ${isActive ? 'text-sky-400' : 'text-slate-400 hover:text-white'}`}>
              {t('nav.home')}
            </NavLink>
            <NavLink to="/catalog" className={({ isActive }) => `text-xs font-bold uppercase tracking-wider transition-colors ${isActive ? 'text-sky-400' : 'text-slate-400 hover:text-white'} flex items-center gap-1.5`}>
               <BookOpen size={14} /> {t('nav.catalog')}
            </NavLink>
            <NavLink to="/annunci" className={({ isActive }) => `text-xs font-bold uppercase tracking-wider transition-colors ${isActive ? 'text-sky-400' : 'text-slate-400 hover:text-white'}`}>
              {t('nav.listings')}
            </NavLink>
            <NavLink to="/aste" className={({ isActive }) => `text-xs font-bold uppercase tracking-wider transition-colors ${isActive ? 'text-amber-400' : 'text-slate-400 hover:text-amber-300'}`}>
              {t('nav.auctions')}
            </NavLink>
            {user && (user.role === 'seller' || user.role === 'both') && (
              <>
                <NavLink to="/sell" className={({ isActive }) => `text-xs font-bold uppercase tracking-wider transition-colors ${isActive ? 'text-sky-400' : 'text-slate-400 hover:text-white'}`}>
                  {t('nav.sell')}
                </NavLink>
                <NavLink to="/create-auction" className={({ isActive }) => `text-xs font-bold uppercase tracking-wider transition-colors ${isActive ? 'text-amber-400' : 'text-slate-400 hover:text-amber-300'}`}>
                  {t('nav.new_auction')}
                </NavLink>
              </>
            )}
          </nav>

          <div className="flex items-center gap-1 min-[350px]:gap-2 md:gap-3">
            {!user ? (
              <div className="hidden sm:flex items-center gap-3">
                <Link to="/login" className="text-xs font-bold text-slate-400 hover:text-white uppercase tracking-widest">{t('nav.login')}</Link>
                <Link to="/register" className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-black rounded uppercase transition-colors">{t('nav.register')}</Link>
              </div>
            ) : (
              <div ref={userDropdownRef} className="relative">
                <button 
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="w-8 h-8 rounded-full border border-white/10 overflow-hidden shrink-0 focus:ring-2 ring-sky-500 ring-offset-2 ring-offset-[#070913] transition-all"
                >
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase">
                      {user.username.charAt(0)}
                    </div>
                  )}
                </button>

                {dropdownOpen && (
                  <div className="absolute top-full right-0 mt-3 w-48 bg-[#0d1224]/85 backdrop-blur-lg border border-white/10 rounded-xl shadow-2xl py-2 z-[60]">
                    <div className="px-4 py-2 border-b border-white/5 mb-1">
                      <p className="text-xs font-bold text-white truncate">{user.username}</p>
                      <p className="text-[10px] text-slate-500">{user.email}</p>
                    </div>
                    <Link to="/profile" className="block px-4 py-2 text-xs text-slate-300 hover:bg-white/5 hover:text-white" onClick={() => setDropdownOpen(false)}>{t('nav.profile')}</Link>
                    <Link to="/my-listings" className="block px-4 py-2 text-xs text-slate-300 hover:bg-white/5 hover:text-white" onClick={() => setDropdownOpen(false)}>{t('nav.my_listings')}</Link>
                    <Link to="/account" className="block px-4 py-2 text-xs text-slate-300 hover:bg-white/5 hover:text-white" onClick={() => setDropdownOpen(false)}>{t('nav.account')}</Link>
                    {user.role === 'admin' && (
                      <Link to="/admin" className="block px-4 py-2 text-xs text-emerald-400 hover:bg-emerald-500/10 font-bold" onClick={() => setDropdownOpen(false)}>{t('nav.admin_panel')}</Link>
                    )}
                    <hr className="border-white/5 my-1" />
                    <button onClick={logout} className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-red-500/10 font-bold">{t('nav.logout')}</button>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-0.5 min-[350px]:gap-1.5 md:gap-3 border-l border-white/5 pl-1.5 min-[350px]:pl-3 md:pl-4 ml-0.5 min-[350px]:ml-1">
              <NotificationBell onNewNotification={handleNewNotification} />
              
              <Link to="/cart" className="relative p-1.5 text-slate-400 hover:text-white transition-colors shrink-0">
                <ShoppingCart size={20} className={cartIsAnimating ? 'scale-125' : ''} />
                {cart?.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-black rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 border-2 border-[#070913]">
                    {cart.length}
                  </span>
                )}
              </Link>

              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-1.5 text-slate-400 hover:text-white transition-colors shrink-0"
              >
                {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Stealth API Status Indicator */}
      <div 
        className={`fixed top-1 left-1 w-2 h-2 rounded-full z-[100] border border-black/20 ${
          apiStatus === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 
          apiStatus === 'offline' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-slate-500 animate-pulse'
        }`}
        title={`API Status: ${apiStatus}`}
      />

      {toastNotif && (
        <div style={{
          position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 100,
          backgroundColor: '#0f172a', border: '1px solid #ef4444', borderLeft: '4px solid #ef4444',
          borderRadius: '8px', padding: '1rem', color: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          maxWidth: '300px',
          animation: 'pulse 1.5s infinite' // Using a generic attention animation we have available
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <strong style={{ color: '#ef4444', fontSize: '1.05rem' }}>{t('ui.attention')}</strong>
            <button onClick={() => setToastNotif(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
          <p style={{ margin: 0, fontSize: '0.95rem' }}>
            {t(toastNotif.message_key, { item: toastNotif.listing_title })}
          </p>
          <Link to={`/product/${toastNotif.listing_id}`} style={{ display: 'inline-block', marginTop: '0.75rem', color: '#38bdf8', fontSize: '0.85rem', fontWeight: 'bold', textDecoration: 'none' }} onClick={() => setToastNotif(null)}>
             {t('ui.go_to_auction')}
          </Link>
        </div>
      )}

      <main className="main pt-16"><Outlet /></main>

      <footer className="footer">
        <p>{t('ui.footer_demo')}</p>
      </footer>

      <style>{`
        .lang-option:hover {
          background-color: rgba(56, 189, 248, 0.05) !important;
          border-color: rgba(56, 189, 248, 0.3) !important;
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

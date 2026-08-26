import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { apiFetch } from '../api';
import { Users, Activity, Package, DollarSign, Star, ShieldAlert, Download, X, Search, ChevronUp, ChevronDown, Database, Zap, BookOpen, LayoutDashboard, Eye, Wallet, UsersRound, Award, Trash2 } from 'lucide-react';
import { useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, flexRender } from '@tanstack/react-table';
import { StitchCard, AnimateCounter, PulsingGlow, StitchPageTransition, StitchBackground } from '../components/StitchComponents';
import SellerTypeBadge from '../components/SellerTypeBadge';

class SafeErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444', backgroundColor: '#292524', borderRadius: '8px' }}>Errore caricamento componente.</div>;
    }
    return this.props.children;
  }
}


export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [stats, setStats] = useState(null);
  const [crmData, setCrmData] = useState([]);
  const [geoData, setGeoData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [listingFlash, setListingFlash] = useState(false);

  // Drill-down Modal State
  const [selectedUser, setSelectedUser] = useState(null);
  const [userHistory, setUserHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Badge Management State
  const [badgeCatalog, setBadgeCatalog] = useState([]);
  const [userBadges, setUserBadges] = useState(null);
  const [badgesLoading, setBadgesLoading] = useState(false);
  const [assignBadgeKey, setAssignBadgeKey] = useState('');
  const [assignBadgeNote, setAssignBadgeNote] = useState('');
  const [badgeActionError, setBadgeActionError] = useState('');
  const [badgeActionBusy, setBadgeActionBusy] = useState(false);

  // Fetch initial data
  useEffect(() => {
    if (!user || user.role !== 'admin') return;

    const fetchData = async () => {
      try {
        const [statsRes, detailedRes, badgesRes] = await Promise.all([
          apiFetch('/api/admin/stats'),
          apiFetch('/api/admin/users/detailed?limit=500'), // fetching a larger batch for client-side CRM testing
          apiFetch('/api/admin/badges'),
        ]);
        setStats(statsRes);
        setCrmData(detailedRes.users || []);
        setGeoData(detailedRes.geoData || []);
        setBadgeCatalog(badgesRes || []);
      } catch (err) {
        setError(err.message || 'Errore durante il caricamento delle statistiche.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    // Simulate micro-feedback when a "new set is indexed" (micro-interaction demo)
    const timer = setTimeout(() => {
      setListingFlash(true);
      setTimeout(() => setListingFlash(false), 2000);
    }, 3000);

    return () => clearTimeout(timer);
  }, [user]);

  // Handle Drill-Down
  const handleRowClick = async (userData) => {
    setSelectedUser(userData);
    setHistoryLoading(true);
    setUserHistory(null);
    setBadgesLoading(true);
    setUserBadges(null);
    setBadgeActionError('');
    setAssignBadgeKey('');
    setAssignBadgeNote('');
    try {
      const [history, badges] = await Promise.all([
        apiFetch(`/api/admin/users/${userData.id}/history`),
        apiFetch(`/api/admin/users/${userData.id}/badges`),
      ]);
      setUserHistory(history);
      setUserBadges(badges);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
      setBadgesLoading(false);
    }
  };

  const refreshUserBadges = async (userId) => {
    const badges = await apiFetch(`/api/admin/users/${userId}/badges`);
    setUserBadges(badges);
  };

  // Keeps the CRM table's PRO/✓ ID pills in sync immediately, without waiting for a full re-fetch.
  const patchCrmLegacyFlags = (userId, badgeKey, value) => {
    if (badgeKey !== 'pro' && badgeKey !== 'verified') return;
    const column = badgeKey === 'pro' ? 'is_pro' : 'is_verified';
    setCrmData(prev => prev.map(u => (u.id === userId ? { ...u, [column]: value } : u)));
  };

  const handleAssignBadge = async () => {
    if (!assignBadgeKey || !selectedUser) return;
    setBadgeActionBusy(true);
    setBadgeActionError('');
    try {
      await apiFetch(`/api/admin/users/${selectedUser.id}/badges`, {
        method: 'POST',
        body: { badgeKey: assignBadgeKey, note: assignBadgeNote.trim() || undefined },
      });
      await refreshUserBadges(selectedUser.id);
      patchCrmLegacyFlags(selectedUser.id, assignBadgeKey, true);
      setAssignBadgeKey('');
      setAssignBadgeNote('');
    } catch (err) {
      setBadgeActionError(err.message || 'Errore nell\'assegnazione del badge.');
    } finally {
      setBadgeActionBusy(false);
    }
  };

  const handleRevokeBadge = async (badgeKey) => {
    if (!selectedUser) return;
    setBadgeActionBusy(true);
    setBadgeActionError('');
    try {
      await apiFetch(`/api/admin/users/${selectedUser.id}/badges/${badgeKey}`, { method: 'DELETE' });
      await refreshUserBadges(selectedUser.id);
      patchCrmLegacyFlags(selectedUser.id, badgeKey, false);
    } catch (err) {
      setBadgeActionError(err.message || 'Errore nella revoca del badge.');
    } finally {
      setBadgeActionBusy(false);
    }
  };

  // TanStack Table Setup
  const columns = useMemo(() => [
    {
      accessorKey: 'username',
      header: 'Utente',
      cell: info => {
        const u = info.row.original;
        const ratingAvg = parseFloat(u.rating_avg || 0);
        const salesCount = parseInt(u.sales_count || 0, 10);
        const isLegendary = ratingAvg >= 4.8 && salesCount >= 10;

        return (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 'bold', color: '#f5f5f4' }}>{u.username}</span>
            <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem' }}>
              {isLegendary && <span style={{ background: 'linear-gradient(90deg, #059669, #10b981)', color: '#fff', padding: '2px 4px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>LEGENDARY</span>}
              {u.is_pro && !isLegendary && <span style={{ backgroundColor: '#eab308', color: '#000', padding: '2px 4px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>PRO</span>}
              {u.is_verified && <span style={{ backgroundColor: '#bf9a2e', color: '#fff', padding: '2px 4px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>✓ ID</span>}
              <SellerTypeBadge sellerType={u.seller_type} />
            </div>
          </div>
        );
      }
    },
    {
      accessorKey: 'address_country',
      header: 'Paese',
      cell: info => info.getValue()?.toUpperCase() || 'N/A'
    },
    {
      accessorKey: 'role',
      header: 'Ruolo',
      cell: info => <span style={{ textTransform: 'capitalize' }}>{info.getValue()}</span>
    },
    {
      accessorKey: 'total_sales',
      header: 'Vendite',
    },
    {
      accessorKey: 'total_purchases',
      header: 'Acquisti',
    },
    {
      id: 'conversion',
      header: 'Win Rate',
      accessorFn: row => {
        const bids = parseInt(row.total_bids || 0, 10);
        const won = parseInt(row.auctions_won || 0, 10);
        if (bids === 0) return 0;
        return (won / bids) * 100;
      },
      cell: info => {
        const bids = info.row.original.total_bids || 0;
        const val = info.getValue();
        return bids > 0 ? `${val.toFixed(1)}%` : '—';
      }
    },
    {
      accessorKey: 'created_at',
      header: 'Registrato',
      cell: info => new Date(info.getValue()).toLocaleDateString()
    }
  ], []);

  const [globalFilter, setGlobalFilter] = useState('');
  
  const table = useReactTable({
    data: crmData,
    columns,
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const exportCSV = () => {
    const headers = ['ID', 'Username', 'Email', 'Country', 'Role', 'Purchases', 'Sales', 'Auctions Created', 'Total Bids', 'Auctions Won', 'Registration Date'];
    const rows = table.getFilteredRowModel().rows.map(row => {
      const u = row.original;
      return [
        u.id, 
        u.username, 
        u.email, 
        u.address_country || 'N/A', 
        u.role, 
        u.total_purchases, 
        u.total_sales, 
        u.auctions_created,
        u.total_bids,
        u.auctions_won,
        new Date(u.created_at).toLocaleDateString()
      ].map(v => `"${v}"`).join(',');
    });
    
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "cardbrix_users_crm.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Heatmap Color Scale removed for React 19 compatibility

  // ── Protection Check ──
  if (!user || user.role !== 'admin') {
    return (
      <div className="page" style={{ padding: '4rem 2rem', display: 'flex', justifyContent: 'center' }}>
        <div style={{
          backgroundColor: '#120f0a', border: '1px solid #ef4444', borderRadius: '16px',
          padding: '3rem', textAlign: 'center', maxWidth: '500px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
        }}>
          <ShieldAlert size={64} color="#ef4444" style={{ margin: '0 auto 1.5rem auto' }} />
          <h2 style={{ color: '#fff', fontSize: '2rem', margin: '0 0 1rem 0' }}>403 Forbidden</h2>
          <p style={{ color: '#a8a29e', marginBottom: '2rem' }}>
            L'accesso a questa sezione è riservato agli amministratori di sistema.
          </p>
          <button onClick={() => navigate('/')} className="btn btn--primary" style={{ width: '100%' }}>
            Torna alla Home
          </button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="page" style={{ padding: '4rem 2rem', textAlign: 'center' }}><p className="muted animate-pulse">Caricamento CRM Avanzato...</p></div>;
  if (error) return <div className="page" style={{ padding: '4rem 2rem', textAlign: 'center' }}><div className="error-banner" style={{ display: 'inline-block' }}>{error}</div></div>;
  if (!stats) return null;

  return (
    <StitchPageTransition>
      <StitchBackground />
      <div className="page" style={{ padding: '2rem', backgroundColor: 'transparent', minHeight: '100vh' }}>
        <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <LayoutDashboard size={32} className="text-gold-500" />
              <h1 style={{ margin: 0, fontSize: '2.5rem', color: '#fff', fontWeight: '900', letterSpacing: '-0.025em' }}>Command Center</h1>
            </div>
            <p style={{ margin: 0, color: '#78716c', fontSize: '1.1rem' }}>Real-time LEGO Asset Intelligence & User CRM</p>
          </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button onClick={exportCSV} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#292524', border: '1px solid #44403c' }}>
            <Download size={18} /> Esporta CSV
          </button>
          <span style={{ color: '#78716c', fontSize: '0.85rem' }}>
            Aggiornato: {new Date(stats.generated_at).toLocaleTimeString('it-IT')}
          </span>
        </div>
      </div>

      {/* KPI BENTO GRID */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        {/* USERS CARD */}
        <StitchCard glowColor="blue">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(212,175,55, 0.1)', borderRadius: '12px' }}><Users size={24} color="#d4af37" /></div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#f5f5f4', fontWeight: '600' }}>Network Users</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '3.5rem', fontWeight: '900', color: '#fff', lineHeight: '1' }}>
              <AnimateCounter value={stats.users.total_users} />
            </span>
            <span style={{ color: '#78716c', fontWeight: '600' }}>Active Nodes</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: 'auto' }}>
            <div><p style={{ margin: '0 0 0.25rem 0', fontSize: '0.8rem', color: '#57534e', textTransform: 'uppercase', fontWeight: 'bold' }}>Sellers</p><p style={{ margin: 0, fontSize: '1.1rem', color: '#e7e5e4', fontWeight: 'bold' }}>{stats.users.total_sellers}</p></div>
            <div><p style={{ margin: '0 0 0.25rem 0', fontSize: '0.8rem', color: '#57534e', textTransform: 'uppercase', fontWeight: 'bold' }}>Pro Tier</p><p style={{ margin: 0, fontSize: '1.1rem', color: '#eab308', fontWeight: 'bold' }}>{stats.users.total_pro}</p></div>
          </div>
        </StitchCard>

        {/* FINANCIALS CARD */}
        <StitchCard glowColor="emerald">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px' }}><DollarSign size={24} color="#10b981" /></div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#f5f5f4', fontWeight: '600' }}>Financial Revenue</h2>
          </div>
          <PulsingGlow active={stats.orders.total_gmv > 1000} color="emerald">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '3.5rem', fontWeight: '900', color: '#fff', lineHeight: '1' }}>
                <AnimateCounter value={stats.orders.total_gmv} prefix="€" />
              </span>
              <span style={{ color: '#78716c', fontWeight: '600' }}>GMV</span>
            </div>
          </PulsingGlow>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: 'auto' }}>
            <div><p style={{ margin: '0 0 0.25rem 0', fontSize: '0.8rem', color: '#57534e', textTransform: 'uppercase', fontWeight: 'bold' }}>Volume</p><p style={{ margin: 0, fontSize: '1.1rem', color: '#e7e5e4', fontWeight: 'bold' }}>{stats.orders.total_orders}</p></div>
            <div><p style={{ margin: '0 0 0.25rem 0', fontSize: '0.8rem', color: '#57534e', textTransform: 'uppercase', fontWeight: 'bold' }}>Settled</p><p style={{ margin: 0, fontSize: '1.1rem', color: '#10b981', fontWeight: 'bold' }}>{stats.orders.completed_orders}</p></div>
          </div>
        </StitchCard>

        {/* LISTINGS CARD */}
        <StitchCard glowColor="amber" flash={listingFlash}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(228,200,115, 0.1)', borderRadius: '12px' }}><Package size={24} color="#eab308" /></div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#f5f5f4', fontWeight: '600' }}>Asset Listings</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '3.5rem', fontWeight: '900', color: '#fff', lineHeight: '1' }}>
              <AnimateCounter value={stats.listings.total_listings} />
            </span>
            <span style={{ color: '#78716c', fontWeight: '600' }}>Total Assets</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
               <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.8rem', color: '#57534e', textTransform: 'uppercase', fontWeight: 'bold' }}>Active</p>
               <p style={{ margin: 0, fontSize: '1.1rem', color: '#e7e5e4', fontWeight: 'bold' }}>{stats.listings.active_listings}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
               <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.8rem', color: '#57534e', textTransform: 'uppercase', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                 <BookOpen size={10} /> Catalog
               </p>
               <p style={{ margin: 0, fontSize: '1.1rem', color: '#d4af37', fontWeight: 'bold' }}>{stats.listings.catalogTotal}</p>
            </div>
          </div>
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #292524' }}>
             <button onClick={() => navigate('/catalog/lego')} style={{ background: 'none', border: 'none', padding: 0, color: '#d4af37', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}>
               Manage Catalog ›
             </button>
          </div>
        </StitchCard>

        {/* VAULT CARD */}
        <StitchCard glowColor="rose" onClick={() => navigate('/admin/archive')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(244, 63, 94, 0.1)', borderRadius: '12px' }}><Database size={24} color="#f43f5e" /></div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#f5f5f4', fontWeight: '600' }}>Secure Vault</h2>
          </div>
          <p style={{ color: '#78716c', fontSize: '1rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>Immutable transaction logs and system-wide asset recovery protocols.</p>
          <div style={{ marginTop: 'auto' }}>
            <span style={{ color: '#f43f5e', fontWeight: 'bold', fontSize: '0.9rem', letterSpacing: '0.05em' }}>ACCESS VAULT →</span>
          </div>
        </StitchCard>

        {/* INTERACTIONS CARD */}
        <StitchCard glowColor="purple" onClick={() => navigate('/admin/interactions')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(212,175,55, 0.1)', borderRadius: '12px' }}><Zap size={24} color="#d4af37" /></div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#f5f5f4', fontWeight: '600' }}>Neural Network</h2>
          </div>
          <p style={{ color: '#78716c', fontSize: '1rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>Mapping user connections and high-frequency trading patterns.</p>
          <div style={{ marginTop: 'auto' }}>
            <span style={{ color: '#d4af37', fontWeight: 'bold', fontSize: '0.9rem', letterSpacing: '0.05em' }}>MAP NETWORK →</span>
          </div>
        </StitchCard>

        {/* ANALYTICS CARD */}
        <StitchCard glowColor="blue" onClick={() => navigate('/admin/analytics')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(212,175,55, 0.1)', borderRadius: '12px' }}><Eye size={24} color="#d4af37" /></div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#f5f5f4', fontWeight: '600' }}>Site Analytics</h2>
          </div>
          <p style={{ color: '#78716c', fontSize: '1rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>Visitatori, sessioni, durata connessione e funnel di registrazione.</p>
          <div style={{ marginTop: 'auto' }}>
            <span style={{ color: '#d4af37', fontWeight: 'bold', fontSize: '0.9rem', letterSpacing: '0.05em' }}>VIEW ANALYTICS →</span>
          </div>
        </StitchCard>

        {/* WALLET LEDGER CARD */}
        <StitchCard glowColor="amber" onClick={() => navigate('/admin/wallet-transactions')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(212,175,55, 0.1)', borderRadius: '12px' }}><Wallet size={24} color="#d4af37" /></div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#f5f5f4', fontWeight: '600' }}>Storico Transazioni Crediti</h2>
          </div>
          <p style={{ color: '#78716c', fontSize: '1rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>Registro immutabile di ogni ricarica, acquisto e movimento wallet di tutti gli utenti.</p>
          <div style={{ marginTop: 'auto' }}>
            <span style={{ color: '#d4af37', fontWeight: 'bold', fontSize: '0.9rem', letterSpacing: '0.05em' }}>APRI STORICO →</span>
          </div>
        </StitchCard>

        {/* SELLER PAYOUTS CARD */}
        <StitchCard glowColor="rose" onClick={() => navigate('/admin/payouts')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(212,175,55, 0.1)', borderRadius: '12px' }}><DollarSign size={24} color="#d4af37" /></div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#f5f5f4', fontWeight: '600' }}>Payout Venditori</h2>
          </div>
          <p style={{ color: '#78716c', fontSize: '1rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>Ordini pagati dall'acquirente: registra qui il bonifico/pagamento manuale al venditore.</p>
          <div style={{ marginTop: 'auto' }}>
            <span style={{ color: '#d4af37', fontWeight: 'bold', fontSize: '0.9rem', letterSpacing: '0.05em' }}>GESTISCI PAYOUT →</span>
          </div>
        </StitchCard>

        {/* USERS LIST CARD */}
        <StitchCard glowColor="emerald" onClick={() => navigate('/admin/users')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px' }}><UsersRound size={24} color="#34d399" /></div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#f5f5f4', fontWeight: '600' }}>Utenti Registrati</h2>
          </div>
          <p style={{ color: '#78716c', fontSize: '1rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>Elenco di tutti gli account con il saldo crediti wallet di ciascuno.</p>
          <div style={{ marginTop: 'auto' }}>
            <span style={{ color: '#34d399', fontWeight: 'bold', fontSize: '0.9rem', letterSpacing: '0.05em' }}>APRI ELENCO →</span>
          </div>
        </StitchCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', marginBottom: '2rem' }}>
        
        {/* GEO-METRICS CARD */}
        <div style={{ backgroundColor: '#120f0a', border: '1px solid #292524', borderRadius: '16px', padding: '1.5rem', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', color: '#f5f5f4' }}>Geographic Insights</h2>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center' }}>
            {geoData.length > 0 ? (
               geoData.sort((a, b) => b.user_count - a.user_count).slice(0, 5).map((d, index) => {
                 const maxCount = geoData[0].user_count;
                 const percentage = (d.user_count / maxCount) * 100;
                 return (
                   <div key={d.country || index} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d6d3d1', fontSize: '0.9rem' }}>
                       <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                         {d.country && <span className={`fi fi-${d.country.toLowerCase()}`} style={{ borderRadius: '2px', width: '16px', height: '12px' }}></span>}
                         {d.country ? d.country.toUpperCase() : 'Sconosciuto'}
                       </span>
                       <span style={{ fontWeight: 'bold' }}>{d.user_count} Utenti</span>
                     </div>
                     <div style={{ width: '100%', backgroundColor: '#292524', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                       <div style={{ width: `${percentage}%`, backgroundColor: '#d4af37', height: '100%', borderRadius: '4px', transition: 'width 0.5s ease' }}></div>
                     </div>
                   </div>
                 );
               })
            ) : (
               <p style={{ color: '#78716c', textAlign: 'center' }}>Dati geografici non disponibili.</p>
            )}
          </div>
        </div>

        {/* CRM DATA TABLE */}
        <div style={{ backgroundColor: '#120f0a', border: '1px solid #292524', borderRadius: '16px', padding: '1.5rem', overflowX: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#f5f5f4' }}>Directory Utenti</h2>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: '#292524', padding: '0.5rem 1rem', borderRadius: '8px' }}>
              <Search size={16} color="#a8a29e" />
              <input 
                type="text" 
                placeholder="Cerca utente, paese..." 
                value={globalFilter ?? ''}
                onChange={e => setGlobalFilter(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', width: '200px' }}
              />
            </div>
          </div>

          <SafeErrorBoundary>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id} style={{ borderBottom: '2px solid #292524' }}>
                    {headerGroup.headers.map(header => (
                      <th key={header.id} onClick={header.column.getToggleSortingHandler()} style={{ textAlign: 'left', padding: '1rem 0.5rem', color: '#a8a29e', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === 'asc' ? <ChevronUp size={14} /> : header.column.getIsSorted() === 'desc' ? <ChevronDown size={14} /> : null}
                        </div>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id} onClick={() => handleRowClick(row.original)} style={{ borderBottom: '1px solid #292524', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(212,175,55, 0.05)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} style={{ padding: '1rem 0.5rem', color: '#e7e5e4' }}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {table.getRowModel().rows.length === 0 && (
               <p style={{ textAlign: 'center', padding: '2rem', color: '#78716c' }}>Nessun utente trovato.</p>
            )}
          </SafeErrorBoundary>
        </div>
      </div>

      {/* USER DRILL-DOWN MODAL */}
      {selectedUser && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setSelectedUser(null)}>
          <div style={{ backgroundColor: '#120f0a', border: '1px solid #292524', borderRadius: '24px', padding: '2rem', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedUser(null)} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: '#a8a29e', cursor: 'pointer' }}><X size={24} /></button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
               <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#292524', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold', color: '#e7e5e4' }}>
                  {selectedUser.username.charAt(0).toUpperCase()}
               </div>
               <div>
                  <h2 style={{ margin: 0, fontSize: '1.8rem', color: '#fff' }}>{selectedUser.username}</h2>
                  <p style={{ margin: 0, color: '#a8a29e' }}>{selectedUser.email} • {selectedUser.address_country?.toUpperCase()}</p>
               </div>
            </div>

            {/* BADGE MANAGEMENT */}
            <div style={{ backgroundColor: '#292524', borderRadius: '16px', padding: '1.5rem', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#f5f5f4', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Award size={18} className="text-gold-400" /> Badge
              </h3>

              {badgesLoading ? (
                <p style={{ color: '#a8a29e', margin: 0 }}>Caricamento badge...</p>
              ) : userBadges ? (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                    {userBadges.manual.length === 0 && userBadges.automatic.every(a => !a.active) && (
                      <span style={{ color: '#78716c', fontSize: '0.85rem' }}>Nessun badge assegnato.</span>
                    )}
                    {userBadges.manual.map(b => (
                      <span
                        key={b.badge_key}
                        title={`${b.note ? b.note + ' — ' : ''}Assegnato ${b.awarded_by_username ? `da ${b.awarded_by_username} ` : ''}il ${new Date(b.awarded_at).toLocaleDateString('it-IT')}`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', backgroundColor: `${b.color}20`, color: b.color, border: `1px solid ${b.color}40`, padding: '0.35rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 'bold' }}
                      >
                        {b.label}
                        <button
                          onClick={() => handleRevokeBadge(b.badge_key)}
                          disabled={badgeActionBusy}
                          title="Revoca badge"
                          style={{ background: 'none', border: 'none', color: 'inherit', cursor: badgeActionBusy ? 'not-allowed' : 'pointer', padding: 0, display: 'flex', opacity: 0.7 }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </span>
                    ))}
                    {userBadges.automatic.filter(a => a.active).map(a => (
                      <span
                        key={a.key}
                        title="Badge automatico: calcolato da rating e vendite, non revocabile manualmente."
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'linear-gradient(90deg, #059669, #10b981)', color: '#fff', padding: '0.35rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 'bold' }}
                      >
                        ★ {a.label} <span style={{ opacity: 0.75, fontWeight: 'normal' }}>(automatico)</span>
                      </span>
                    ))}
                  </div>

                  {badgeActionError && (
                    <p style={{ color: '#ef4444', fontSize: '0.8rem', margin: '0 0 0.75rem 0' }}>{badgeActionError}</p>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                    <select
                      value={assignBadgeKey}
                      onChange={e => setAssignBadgeKey(e.target.value)}
                      style={{ backgroundColor: '#171412', color: '#e7e5e4', border: '1px solid #44403c', borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                    >
                      <option value="">Assegna badge...</option>
                      {badgeCatalog
                        .filter(b => b.is_manual && !userBadges.manual.some(m => m.badge_key === b.key))
                        .map(b => (
                          <option key={b.key} value={b.key}>{b.label}</option>
                        ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Nota (opzionale)"
                      value={assignBadgeNote}
                      onChange={e => setAssignBadgeNote(e.target.value)}
                      style={{ flex: 1, minWidth: '160px', backgroundColor: '#171412', color: '#e7e5e4', border: '1px solid #44403c', borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                    />
                    <button
                      onClick={handleAssignBadge}
                      disabled={!assignBadgeKey || badgeActionBusy}
                      style={{ backgroundColor: '#d4af37', color: '#171412', border: 'none', borderRadius: '8px', padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: 'bold', cursor: (!assignBadgeKey || badgeActionBusy) ? 'not-allowed' : 'pointer', opacity: (!assignBadgeKey || badgeActionBusy) ? 0.5 : 1 }}
                    >
                      Assegna
                    </button>
                  </div>
                </>
              ) : null}
            </div>

            {historyLoading ? (
               <p style={{ textAlign: 'center', color: '#a8a29e' }}>Caricamento storia...</p>
            ) : userHistory ? (
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                 
                 {/* Conversion Gauge */}
                 <div style={{ backgroundColor: '#292524', borderRadius: '16px', padding: '1.5rem', position: 'relative' }}>
                    <h3 style={{ margin: '0 0 1rem 0', color: '#f5f5f4' }}>Bid Conversion</h3>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', marginBottom: '1rem' }}>
                       <span style={{ fontSize: '3.5rem', fontWeight: '900', color: '#10b981', lineHeight: 1 }}>
                          {selectedUser.total_bids > 0 ? ((selectedUser.auctions_won / selectedUser.total_bids) * 100).toFixed(0) : 0}%
                       </span>
                       <div style={{ paddingBottom: '0.5rem', color: '#a8a29e' }}>
                         <p style={{ margin: 0 }}>Vinte: <strong>{selectedUser.auctions_won}</strong></p>
                         <p style={{ margin: 0 }}>Totali: <strong>{selectedUser.total_bids}</strong></p>
                       </div>
                    </div>
                    {(() => {
                      const winRate = selectedUser.total_bids > 0 ? (selectedUser.auctions_won / selectedUser.total_bids) * 100 : 0;
                      let label = "Nuovo Bidder";
                      let color = "#a8a29e";
                      if (selectedUser.total_bids > 0) {
                        if (winRate > 50) { label = "Aggressive Sniper"; color = "#ef4444"; }
                        else if (winRate >= 20) { label = "Balanced Bidder"; color = "#bf9a2e"; }
                        else { label = "Conservative Bidder"; color = "#d4af37"; }
                      }
                      return (
                        <div style={{ display: 'inline-block', backgroundColor: `${color}20`, color: color, padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 'bold', border: `1px solid ${color}40` }}>
                          {label}
                        </div>
                      );
                    })()}
                 </div>

                 {/* Top Categories */}
                 <div style={{ backgroundColor: '#292524', borderRadius: '16px', padding: '1.5rem' }}>
                    <h3 style={{ margin: '0 0 1rem 0', color: '#f5f5f4' }}>Top Vendite</h3>
                    {userHistory.topCategories.length > 0 ? (
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {userHistory.topCategories.map((c, i) => (
                           <li key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#d6d3d1' }}>
                             <span>{c.theme}</span>
                             <span style={{ fontWeight: 'bold' }}>{c.sales_count}</span>
                           </li>
                        ))}
                      </ul>
                    ) : (
                      <p style={{ color: '#78716c', margin: 0 }}>Nessuna vendita registrata.</p>
                    )}
                 </div>

                 {/* Bids Timeline */}
                 <div style={{ gridColumn: '1 / -1', backgroundColor: '#292524', borderRadius: '16px', padding: '1.5rem' }}>
                    <h3 style={{ margin: '0 0 1rem 0', color: '#f5f5f4' }}>Cronologia Offerte</h3>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                       {userHistory.bids.length > 0 ? (
                         userHistory.bids.map(b => (
                            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #44403c' }}>
                               <div>
                                  <span style={{ color: '#e7e5e4', fontWeight: 'bold', display: 'block' }}>{b.listing_title}</span>
                                  <span style={{ color: '#78716c', fontSize: '0.8rem' }}>{new Date(b.created_at).toLocaleString()}</span>
                               </div>
                               <div style={{ textAlign: 'right' }}>
                                  <span style={{ color: '#fff', fontWeight: 'bold', display: 'block' }}>€{b.amount}</span>
                                  <span style={{ color: b.is_winning ? '#10b981' : '#ef4444', fontSize: '0.8rem', fontWeight: 'bold' }}>{b.is_winning ? 'VINCENTE' : 'PERSA'}</span>
                               </div>
                            </div>
                         ))
                       ) : (
                          <p style={{ color: '#78716c', margin: 0 }}>Nessuna offerta registrata.</p>
                       )}
                    </div>
                 </div>

               </div>
            ) : null}
          </div>
        </div>
      )}
      </div>
    </StitchPageTransition>
  );
}

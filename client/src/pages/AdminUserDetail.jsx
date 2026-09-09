import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiFetch } from '../api';
import { StitchCard, AnimateCounter } from '../components/StitchComponents';
import {
  ArrowLeft, ShieldCheck, BadgeCheck, Coins, Eye, Clock, Activity,
  Calendar, Ban, Trash2, CheckCircle2,
} from 'lucide-react';

const ROLES = [
  { value: 'buyer', label: 'Buyer' },
  { value: 'seller', label: 'Seller' },
  { value: 'both', label: 'Buyer + Seller' },
  { value: 'shop', label: 'Shop' },
  { value: 'admin', label: 'Admin' },
];

const STATUSES = [
  { value: 'active', label: 'Attivo', icon: CheckCircle2, activeClasses: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40' },
  { value: 'banned', label: 'Bannato', icon: Ban, activeClasses: 'bg-amber-500/15 text-amber-400 border-amber-500/40' },
  { value: 'deleted', label: 'Cancellato', icon: Trash2, activeClasses: 'bg-red-500/15 text-red-400 border-red-500/40' },
];

function formatDuration(totalSeconds) {
  const s = Number(totalSeconds) || 0;
  if (s < 60) return `${s}s`;
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  if (days > 0) return `${days}g ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatDate(value) {
  if (!value) return 'Mai';
  return new Date(value).toLocaleString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminUserDetail() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingRole, setSavingRole] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [pendingRole, setPendingRole] = useState('');
  const [banner, setBanner] = useState(null); // { type: 'success'|'error', message }

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [userData, activityData] = await Promise.all([
        apiFetch(`/api/admin/users/${id}`),
        apiFetch(`/api/admin/users/${id}/activity`),
      ]);
      setUser(userData);
      setPendingRole(userData.role);
      setActivity(activityData);
      setError('');
    } catch (err) {
      setError(err.data?.error || 'Errore nel caricamento del profilo utente.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 4000);
    return () => clearTimeout(t);
  }, [banner]);

  const saveRole = async () => {
    if (pendingRole === user.role) return;
    setSavingRole(true);
    try {
      const data = await apiFetch(`/api/admin/users/${id}`, { method: 'PATCH', body: { role: pendingRole } });
      setUser((u) => ({ ...u, role: data.user.role }));
      setBanner({ type: 'success', message: `Ruolo aggiornato a "${data.user.role}".` });
    } catch (err) {
      setBanner({ type: 'error', message: err.data?.error || 'Errore nel salvataggio del ruolo.' });
      setPendingRole(user.role);
    } finally {
      setSavingRole(false);
    }
  };

  const changeStatus = async (status) => {
    if (status === user.accountStatus) return;
    if (status !== 'active') {
      const label = STATUSES.find((s) => s.value === status)?.label || status;
      if (!window.confirm(`Confermi di voler impostare l'account di "${user.username}" su "${label}"? L'utente non potrà più accedere.`)) {
        return;
      }
    }
    setSavingStatus(true);
    try {
      const data = await apiFetch(`/api/admin/users/${id}`, { method: 'PATCH', body: { status } });
      setUser((u) => ({ ...u, accountStatus: data.user.accountStatus, isActive: data.user.isActive }));
      setBanner({ type: 'success', message: `Stato account aggiornato a "${STATUSES.find(s => s.value === status)?.label}".` });
    } catch (err) {
      setBanner({ type: 'error', message: err.data?.error || 'Errore nel salvataggio dello stato.' });
    } finally {
      setSavingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-stone-400">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-gold-500 mr-3" />
        Caricamento profilo...
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Link to="/admin/users" className="flex items-center gap-2 text-stone-400 hover:text-white transition-colors mb-4 text-sm">
          <ArrowLeft size={16} /> Utenti
        </Link>
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-400">
          {error || 'Utente non trovato.'}
        </div>
      </div>
    );
  }

  const currentStatus = STATUSES.find((s) => s.value === user.accountStatus) || STATUSES[0];

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <Link to="/admin/users" className="flex items-center gap-2 text-stone-400 hover:text-white transition-colors mb-4 text-sm">
        <ArrowLeft size={16} /> Utenti
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-2xl bg-stone-800 border border-stone-700 overflow-hidden flex items-center justify-center shrink-0">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl font-black text-gold-400">{user.username?.[0]?.toUpperCase()}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2 flex-wrap">
            {user.username}
            {user.role === 'admin' && <ShieldCheck size={18} className="text-gold-400" />}
            {user.isVerified && <BadgeCheck size={18} className="text-blue-400" />}
          </h1>
          <p className="text-stone-400 text-sm truncate">{user.email}</p>
        </div>
        <span className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border ${currentStatus.activeClasses}`}>
          {currentStatus.label}
        </span>
      </div>

      {banner && (
        <div className={`mb-6 px-4 py-3 rounded-xl text-sm font-medium border ${
          banner.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {banner.message}
        </div>
      )}

      {/* Activity counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StitchCard glowColor="amber" className="p-5">
          <div className="flex items-center gap-2 text-stone-500 text-[10px] font-black uppercase tracking-widest mb-2">
            <Eye size={13} /> Pagine visitate
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">
            <AnimateCounter value={activity?.totalPageviews || 0} />
          </div>
        </StitchCard>
        <StitchCard glowColor="emerald" className="p-5">
          <div className="flex items-center gap-2 text-stone-500 text-[10px] font-black uppercase tracking-widest mb-2">
            <Clock size={13} /> Tempo totale
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">
            {formatDuration(activity?.totalTimeSeconds || 0)}
          </div>
        </StitchCard>
        <StitchCard glowColor="blue" className="p-5">
          <div className="flex items-center gap-2 text-stone-500 text-[10px] font-black uppercase tracking-widest mb-2">
            <Activity size={13} /> Sessioni
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">
            <AnimateCounter value={activity?.sessionCount || 0} />
          </div>
        </StitchCard>
        <StitchCard glowColor="purple" className="p-5">
          <div className="flex items-center gap-2 text-stone-500 text-[10px] font-black uppercase tracking-widest mb-2">
            <Calendar size={13} /> Ultima visita
          </div>
          <div className="text-sm sm:text-base font-bold text-white leading-tight">
            {formatDate(activity?.lastSeenAt)}
          </div>
        </StitchCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: role/status editors + wallet */}
        <div className="lg:col-span-1 space-y-6">
          <StitchCard glowColor="blue" className="p-5">
            <h2 className="text-xs font-black uppercase tracking-widest text-stone-500 mb-3">Ruolo</h2>
            <select
              value={pendingRole}
              onChange={(e) => setPendingRole(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#161209] border border-stone-700 text-white text-sm outline-none focus:border-gold-500 transition-colors mb-3"
            >
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <button
              onClick={saveRole}
              disabled={savingRole || pendingRole === user.role}
              className="w-full px-4 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-wider transition-colors"
            >
              {savingRole ? 'Salvataggio...' : 'Salva ruolo'}
            </button>
          </StitchCard>

          <StitchCard glowColor="rose" className="p-5">
            <h2 className="text-xs font-black uppercase tracking-widest text-stone-500 mb-3">Stato account</h2>
            <div className="grid grid-cols-1 gap-2">
              {STATUSES.map((s) => {
                const Icon = s.icon;
                const isCurrent = user.accountStatus === s.value;
                return (
                  <button
                    key={s.value}
                    onClick={() => changeStatus(s.value)}
                    disabled={savingStatus || isCurrent}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold uppercase tracking-wider transition-colors disabled:cursor-default ${
                      isCurrent ? s.activeClasses : 'bg-stone-800/50 border-stone-700 text-stone-400 hover:border-stone-600'
                    }`}
                  >
                    <Icon size={14} /> {s.label} {isCurrent && '(attuale)'}
                  </button>
                );
              })}
            </div>
          </StitchCard>

          <StitchCard glowColor="amber" className="p-5">
            <h2 className="text-xs font-black uppercase tracking-widest text-stone-500 mb-3 flex items-center gap-2">
              <Coins size={13} /> Wallet
            </h2>
            <div className="text-2xl font-black text-gold-400">
              {user.balanceCredits !== null ? `${user.balanceCredits.toFixed(2)} CR` : '—'}
            </div>
            <p className="text-stone-500 text-[11px] mt-1">Registrato il {formatDate(user.createdAt)}</p>
          </StitchCard>
        </div>

        {/* Right: top visited pages */}
        <div className="lg:col-span-2">
          <StitchCard glowColor="blue" className="p-5">
            <h2 className="text-xs font-black uppercase tracking-widest text-stone-500 mb-4">Pagine più visitate</h2>
            {activity?.topPages?.length > 0 ? (
              <div className="divide-y divide-stone-800/50">
                {activity.topPages.map((p) => (
                  <div key={p.path} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="text-stone-300 font-mono truncate pr-4">{p.path}</span>
                    <span className="text-gold-400 font-bold shrink-0">{p.views}×</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-stone-500 text-sm py-4 text-center">Nessuna attività di navigazione registrata.</p>
            )}
          </StitchCard>
        </div>
      </div>
    </div>
  );
}

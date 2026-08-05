import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { apiFetch } from '../api';
import { Eye, ShieldAlert, ArrowLeft, Clock, UserPlus, TrendingUp, MousePointerClick, CalendarDays } from 'lucide-react';
import { useReactTable, getCoreRowModel, getSortedRowModel, flexRender } from '@tanstack/react-table';
import { StitchCard, AnimateCounter, StitchPageTransition, StitchBackground } from '../components/StitchComponents';

function formatDuration(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

export default function AdminAnalytics() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [overview, setOverview] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [behavior, setBehavior] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;

    const fetchData = async () => {
      try {
        const [overviewRes, sessionsRes, behaviorRes] = await Promise.all([
          apiFetch('/api/admin/analytics/overview'),
          apiFetch('/api/admin/analytics/sessions?limit=50'),
          apiFetch('/api/admin/analytics/behavior'),
        ]);
        setOverview(overviewRes);
        setSessions(sessionsRes || []);
        setBehavior(behaviorRes);
      } catch (err) {
        setError(err.message || 'Errore durante il caricamento delle statistiche di analytics.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const columns = useMemo(() => [
    {
      id: 'visitor',
      header: 'Visitatore',
      cell: info => {
        const s = info.row.original;
        return s.username
          ? <span style={{ fontWeight: 'bold', color: '#f5f5f4' }}>{s.username}</span>
          : <span style={{ color: '#78716c', fontFamily: 'monospace', fontSize: '0.8rem' }}>{s.visitor_id.slice(0, 8)}…</span>;
      }
    },
    { accessorKey: 'entry_path', header: 'Pagina di ingresso' },
    {
      accessorKey: 'started_at',
      header: 'Iniziata',
      cell: info => new Date(info.getValue()).toLocaleString('it-IT')
    },
    {
      accessorKey: 'duration_seconds',
      header: 'Durata',
      cell: info => formatDuration(info.getValue())
    },
    { accessorKey: 'pageview_count', header: 'Pagine viste' },
  ], []);

  const table = useReactTable({
    data: sessions,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

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

  if (loading) return <div className="page" style={{ padding: '4rem 2rem', textAlign: 'center' }}><p className="muted animate-pulse">Caricamento Analytics...</p></div>;
  if (error) return <div className="page" style={{ padding: '4rem 2rem', textAlign: 'center' }}><div className="error-banner" style={{ display: 'inline-block' }}>{error}</div></div>;
  if (!overview) return null;

  const maxDaily = Math.max(1, ...overview.daily_series.map(d => d.visitors));
  const { started, completed, conversion_rate } = overview.funnel;
  const countries = overview.geo?.countries || [];
  const maxCountryVisitors = Math.max(1, ...countries.map(c => c.visitors));
  const { total_visitors, authenticated_visitors, bounced_visitors, authentication_rate } = overview.auth_funnel || {
    total_visitors: 0, authenticated_visitors: 0, bounced_visitors: 0, authentication_rate: 0,
  };

  return (
    <StitchPageTransition>
      <StitchBackground />
      <div className="page" style={{ padding: '2rem', backgroundColor: 'transparent', minHeight: '100vh' }}>
        <div style={{ marginBottom: '2rem' }}>
          <Link to="/admin" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#78716c', fontSize: '0.85rem', textDecoration: 'none', marginBottom: '1rem' }}>
            <ArrowLeft size={14} /> Torna al Command Center
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <Eye size={32} className="text-gold-400" />
                <h1 style={{ margin: 0, fontSize: '2.5rem', color: '#fff', fontWeight: '900', letterSpacing: '-0.025em' }}>Site Analytics</h1>
              </div>
              <p style={{ margin: 0, color: '#78716c', fontSize: '1.1rem' }}>Visite, sessioni e funnel di registrazione</p>
            </div>
            <Link
              to="/admin/analytics/calendar"
              className="btn btn--primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}
            >
              <CalendarDays size={16} /> Calendario Storico
            </Link>
          </div>
        </div>

        {/* KPI GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: '1.5rem', marginBottom: '2rem', display: 'grid' }}>
          <StitchCard glowColor="blue">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ padding: '0.6rem', backgroundColor: 'rgba(212,175,55, 0.1)', borderRadius: '12px' }}><Eye size={20} color="#d4af37" /></div>
              <h2 style={{ margin: 0, fontSize: '1rem', color: '#f5f5f4', fontWeight: '600' }}>Visitatori</h2>
            </div>
            <span style={{ fontSize: '2.5rem', fontWeight: '900', color: '#fff', lineHeight: '1' }}>
              <AnimateCounter value={overview.visitors.today} />
            </span>
            <p style={{ margin: '0.5rem 0 0 0', color: '#78716c', fontSize: '0.85rem' }}>oggi · {overview.visitors.last_7d} negli ultimi 7 giorni</p>
          </StitchCard>

          <StitchCard glowColor="emerald">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ padding: '0.6rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px' }}><Clock size={20} color="#10b981" /></div>
              <h2 style={{ margin: 0, fontSize: '1rem', color: '#f5f5f4', fontWeight: '600' }}>Durata Media Sessione</h2>
            </div>
            <span style={{ fontSize: '2.5rem', fontWeight: '900', color: '#fff', lineHeight: '1' }}>
              {formatDuration(overview.sessions.avg_duration_seconds)}
            </span>
            <p style={{ margin: '0.5rem 0 0 0', color: '#78716c', fontSize: '0.85rem' }}>{overview.sessions.last_7d} sessioni negli ultimi 7 giorni</p>
          </StitchCard>

          <StitchCard glowColor="amber">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ padding: '0.6rem', backgroundColor: 'rgba(228,200,115, 0.1)', borderRadius: '12px' }}><UserPlus size={20} color="#eab308" /></div>
              <h2 style={{ margin: 0, fontSize: '1rem', color: '#f5f5f4', fontWeight: '600' }}>Nuove Registrazioni</h2>
            </div>
            <span style={{ fontSize: '2.5rem', fontWeight: '900', color: '#fff', lineHeight: '1' }}>
              <AnimateCounter value={overview.registrations.today} />
            </span>
            <p style={{ margin: '0.5rem 0 0 0', color: '#78716c', fontSize: '0.85rem' }}>oggi · {overview.registrations.last_7d} negli ultimi 7 giorni</p>
          </StitchCard>

          <StitchCard glowColor="purple">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ padding: '0.6rem', backgroundColor: 'rgba(212,175,55, 0.1)', borderRadius: '12px' }}><TrendingUp size={20} color="#d4af37" /></div>
              <h2 style={{ margin: 0, fontSize: '1rem', color: '#f5f5f4', fontWeight: '600' }}>Conversione Registrazione</h2>
            </div>
            <span style={{ fontSize: '2.5rem', fontWeight: '900', color: '#fff', lineHeight: '1' }}>
              {conversion_rate}%
            </span>
            <p style={{ margin: '0.5rem 0 0 0', color: '#78716c', fontSize: '0.85rem' }}>{completed} completate su {started} iniziate (30gg)</p>
          </StitchCard>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', marginBottom: '2rem' }}>

          {/* DAILY VISITS */}
          <div style={{ backgroundColor: '#120f0a', border: '1px solid #292524', borderRadius: '16px', padding: '1.5rem', overflowX: 'auto' }}>
            <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', color: '#f5f5f4' }}>Visite Giornaliere (14 giorni)</h2>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: '180px', minWidth: '560px' }}>
              {overview.daily_series.map((d) => {
                const pct = Math.max(2, (d.visitors / maxDaily) * 100);
                return (
                  <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', height: '100%', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: '0.7rem', color: '#d6d3d1', fontWeight: 'bold' }}>{d.visitors}</span>
                    <div
                      style={{
                        width: '100%', height: `${pct}%`, backgroundColor: '#d4af37',
                        borderRadius: '4px 4px 0 0', transition: 'height 0.5s ease', minHeight: '4px'
                      }}
                      title={`${d.visitors} visitatori, ${d.pageviews} pagine viste`}
                    />
                    <span style={{ fontSize: '0.65rem', color: '#57534e' }}>
                      {new Date(d.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* REGISTRATION FUNNEL */}
          <div style={{ backgroundColor: '#120f0a', border: '1px solid #292524', borderRadius: '16px', padding: '1.5rem' }}>
            <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', color: '#f5f5f4' }}>Funnel Registrazione (30 giorni)</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d6d3d1', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                  <span>Iniziata</span>
                  <span style={{ fontWeight: 'bold' }}>{started}</span>
                </div>
                <div style={{ width: '100%', backgroundColor: '#292524', height: '14px', borderRadius: '7px', overflow: 'hidden' }}>
                  <div style={{ width: '100%', backgroundColor: '#d4af37', height: '100%' }} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d6d3d1', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                  <span>Completata</span>
                  <span style={{ fontWeight: 'bold' }}>{completed} ({conversion_rate}%)</span>
                </div>
                <div style={{ width: '100%', backgroundColor: '#292524', height: '14px', borderRadius: '7px', overflow: 'hidden' }}>
                  <div style={{ width: `${started > 0 ? (completed / started) * 100 : 0}%`, backgroundColor: '#bf9a2e', height: '100%', transition: 'width 0.5s ease' }} />
                </div>
              </div>
              <p style={{ margin: 0, color: '#78716c', fontSize: '0.8rem' }}>
                Traccia solo l'evento (nessun dato di form viene salvato per i tentativi abbandonati).
              </p>
            </div>
          </div>

          {/* AUTH FUNNEL: visitors -> authenticated (login or registration) vs bounced */}
          <div style={{ backgroundColor: '#120f0a', border: '1px solid #292524', borderRadius: '16px', padding: '1.5rem' }}>
            <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', color: '#f5f5f4' }}>Funnel di Autenticazione (30 giorni)</h2>
            <p style={{ margin: '0 0 1.5rem 0', color: '#78716c', fontSize: '0.85rem' }}>Visitatori che accedono o si registrano rispetto a chi abbandona senza autenticarsi</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d6d3d1', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                  <span>Visitatori Totali</span>
                  <span style={{ fontWeight: 'bold' }}>{total_visitors}</span>
                </div>
                <div style={{ width: '100%', backgroundColor: '#292524', height: '14px', borderRadius: '7px', overflow: 'hidden' }}>
                  <div style={{ width: '100%', backgroundColor: '#d4af37', height: '100%' }} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d6d3d1', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                  <span>Registrati o Accessi</span>
                  <span style={{ fontWeight: 'bold', color: '#10b981' }}>{authenticated_visitors} ({authentication_rate}%)</span>
                </div>
                <div style={{ width: '100%', backgroundColor: '#292524', height: '14px', borderRadius: '7px', overflow: 'hidden' }}>
                  <div style={{ width: `${total_visitors > 0 ? (authenticated_visitors / total_visitors) * 100 : 0}%`, backgroundColor: '#10b981', height: '100%', transition: 'width 0.5s ease' }} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d6d3d1', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                  <span>Abbandonati (nessuna registrazione/accesso)</span>
                  <span style={{ fontWeight: 'bold', color: '#f87171' }}>{bounced_visitors}</span>
                </div>
                <div style={{ width: '100%', backgroundColor: '#292524', height: '14px', borderRadius: '7px', overflow: 'hidden' }}>
                  <div style={{ width: `${total_visitors > 0 ? (bounced_visitors / total_visitors) * 100 : 0}%`, backgroundColor: '#f87171', height: '100%', transition: 'width 0.5s ease' }} />
                </div>
              </div>
            </div>
          </div>

          {/* GEOGRAPHIC ORIGINS */}
          <div style={{ backgroundColor: '#120f0a', border: '1px solid #292524', borderRadius: '16px', padding: '1.5rem', overflowX: 'auto' }}>
            <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', color: '#f5f5f4' }}>Origini Geografiche (30 giorni)</h2>
            <p style={{ margin: '0 0 1.5rem 0', color: '#78716c', fontSize: '0.85rem' }}>Da dove si collegano i visitatori (risolto via IP, "??" = non risolvibile, es. rete locale)</p>
            {countries.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '2rem', color: '#78716c' }}>Nessun dato geografico disponibile.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {countries.map((c) => (
                  <div key={c.country} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {c.country !== '??' ? (
                      <span className={`fi fi-${c.country.toLowerCase()}`} style={{ fontSize: '1.1rem', width: '28px', flexShrink: 0, borderRadius: '2px' }} />
                    ) : (
                      <span style={{ width: '28px', flexShrink: 0, textAlign: 'center', color: '#57534e' }}>—</span>
                    )}
                    <span style={{ width: '32px', flexShrink: 0, color: '#d6d3d1', fontSize: '0.85rem', fontWeight: 'bold' }}>{c.country}</span>
                    <div style={{ flex: 1, backgroundColor: '#292524', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
                      <div style={{ width: `${(c.visitors / maxCountryVisitors) * 100}%`, backgroundColor: '#d4af37', height: '100%', transition: 'width 0.5s ease' }} />
                    </div>
                    <span style={{ width: '40px', flexShrink: 0, textAlign: 'right', color: '#f5f5f4', fontWeight: 'bold', fontSize: '0.85rem' }}>{c.visitors}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SESSIONS TABLE */}
          <div style={{ backgroundColor: '#120f0a', border: '1px solid #292524', borderRadius: '16px', padding: '1.5rem', overflowX: 'auto' }}>
            <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', color: '#f5f5f4' }}>Sessioni Recenti</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id} style={{ borderBottom: '2px solid #292524' }}>
                    {headerGroup.headers.map(header => (
                      <th key={header.id} onClick={header.column.getToggleSortingHandler()} style={{ textAlign: 'left', padding: '1rem 0.5rem', color: '#a8a29e', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id} style={{ borderBottom: '1px solid #292524' }}>
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} style={{ padding: '1rem 0.5rem', color: '#e7e5e4', whiteSpace: 'nowrap' }}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {sessions.length === 0 && (
              <p style={{ textAlign: 'center', padding: '2rem', color: '#78716c' }}>Nessuna sessione registrata.</p>
            )}
          </div>

          {/* COMPORTAMENTO UTENTI */}
          <div style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
              <MousePointerClick size={24} className="text-gold-400" />
              <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#fff', fontWeight: '800' }}>Comportamento Utenti</h2>
            </div>
            <p style={{ margin: '0 0 1rem 0', color: '#78716c', fontSize: '0.9rem' }}>Su quali pagine restano di più e cosa cliccano (ultimi 30 giorni)</p>
          </div>

          {/* TIME PER PAGE */}
          <div style={{ backgroundColor: '#120f0a', border: '1px solid #292524', borderRadius: '16px', padding: '1.5rem', overflowX: 'auto' }}>
            <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: '#f5f5f4' }}>Tempo Medio per Pagina</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #292524' }}>
                  <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem', color: '#a8a29e' }}>Pagina</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem', color: '#a8a29e' }}>Visite</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem', color: '#a8a29e' }}>Tempo medio</th>
                </tr>
              </thead>
              <tbody>
                {(behavior?.top_pages_by_time || []).map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #292524' }}>
                    <td style={{ padding: '0.75rem 0.5rem', color: '#e7e5e4', fontFamily: 'monospace' }}>{p.path}</td>
                    <td style={{ padding: '0.75rem 0.5rem', color: '#e7e5e4' }}>{p.views}</td>
                    <td style={{ padding: '0.75rem 0.5rem', color: '#10b981', fontWeight: 'bold' }}>{formatDuration(p.avg_duration_seconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!behavior?.top_pages_by_time || behavior.top_pages_by_time.length === 0) && (
              <p style={{ textAlign: 'center', padding: '2rem', color: '#78716c' }}>Dati non ancora disponibili.</p>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: '2rem', display: 'grid' }}>
            {/* TOP CLICKS OVERALL */}
            <div style={{ backgroundColor: '#120f0a', border: '1px solid #292524', borderRadius: '16px', padding: '1.5rem', overflowX: 'auto' }}>
              <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: '#f5f5f4' }}>Elementi Più Cliccati</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #292524' }}>
                    <th style={{ textAlign: 'left', padding: '0.6rem 0.5rem', color: '#a8a29e' }}>Elemento</th>
                    <th style={{ textAlign: 'left', padding: '0.6rem 0.5rem', color: '#a8a29e' }}>Tipo</th>
                    <th style={{ textAlign: 'right', padding: '0.6rem 0.5rem', color: '#a8a29e' }}>Click</th>
                  </tr>
                </thead>
                <tbody>
                  {(behavior?.top_clicks || []).map((c, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #292524' }}>
                      <td style={{ padding: '0.6rem 0.5rem', color: '#e7e5e4', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.target_href || c.target_label}>{c.target_label}</td>
                      <td style={{ padding: '0.6rem 0.5rem', color: '#a8a29e', textTransform: 'uppercase', fontSize: '0.7rem' }}>{c.target_type}</td>
                      <td style={{ padding: '0.6rem 0.5rem', color: '#d4af37', fontWeight: 'bold', textAlign: 'right' }}>{c.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!behavior?.top_clicks || behavior.top_clicks.length === 0) && (
                <p style={{ textAlign: 'center', padding: '2rem', color: '#78716c' }}>Nessun click registrato.</p>
              )}
            </div>

            {/* TOP CLICKS BY PAGE */}
            <div style={{ backgroundColor: '#120f0a', border: '1px solid #292524', borderRadius: '16px', padding: '1.5rem', overflowX: 'auto' }}>
              <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: '#f5f5f4' }}>Click per Pagina</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #292524' }}>
                    <th style={{ textAlign: 'left', padding: '0.6rem 0.5rem', color: '#a8a29e' }}>Pagina</th>
                    <th style={{ textAlign: 'left', padding: '0.6rem 0.5rem', color: '#a8a29e' }}>Elemento</th>
                    <th style={{ textAlign: 'right', padding: '0.6rem 0.5rem', color: '#a8a29e' }}>Click</th>
                  </tr>
                </thead>
                <tbody>
                  {(behavior?.top_clicks_by_page || []).map((c, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #292524' }}>
                      <td style={{ padding: '0.6rem 0.5rem', color: '#e7e5e4', fontFamily: 'monospace', fontSize: '0.75rem' }}>{c.path}</td>
                      <td style={{ padding: '0.6rem 0.5rem', color: '#e7e5e4', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.target_label}>{c.target_label}</td>
                      <td style={{ padding: '0.6rem 0.5rem', color: '#d4af37', fontWeight: 'bold', textAlign: 'right' }}>{c.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!behavior?.top_clicks_by_page || behavior.top_clicks_by_page.length === 0) && (
                <p style={{ textAlign: 'center', padding: '2rem', color: '#78716c' }}>Nessun click registrato.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </StitchPageTransition>
  );
}

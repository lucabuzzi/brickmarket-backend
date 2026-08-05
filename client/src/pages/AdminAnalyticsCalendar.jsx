import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { apiFetch } from '../api';
import { CalendarDays, ShieldAlert, ArrowLeft, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { StitchCard, StitchPageTransition, StitchBackground } from '../components/StitchComponents';

const MONTH_NAMES = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];
const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

function formatDuration(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

/** Builds a Mon-Sun grid of dates (including leading/trailing days from
 * neighboring months, as null) for the given year/month (month is 1-12). */
function buildMonthGrid(year, month) {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekday = (firstOfMonth.getUTCDay() + 6) % 7; // 0=Mon..6=Sun

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function AdminAnalyticsCalendar() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const today = new Date();
  const [year, setYear] = useState(today.getUTCFullYear());
  const [month, setMonth] = useState(today.getUTCMonth() + 1);
  const [daysByDate, setDaysByDate] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;

    const fetchCalendar = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`/api/admin/analytics/calendar?year=${year}&month=${month}`);
        const map = {};
        (res.days || []).forEach((d) => { map[d.date] = d; });
        setDaysByDate(map);
      } catch (err) {
        setError(err.message || 'Errore durante il caricamento del calendario.');
      } finally {
        setLoading(false);
      }
    };
    fetchCalendar();
  }, [user, year, month]);

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const maxVisitors = useMemo(
    () => Math.max(1, ...Object.values(daysByDate).map((d) => d.visitors || 0)),
    [daysByDate]
  );

  const goPrevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); } else { setMonth(m => m - 1); }
  };
  const goNextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); } else { setMonth(m => m + 1); }
  };

  const openDay = (dateStr) => {
    if (!dateStr) return;
    setSelectedDate(dateStr);
    setSelectedDetail(null);
    setDetailLoading(true);
    apiFetch(`/api/admin/analytics/day?date=${dateStr}`)
      .then(setSelectedDetail)
      .catch(() => setSelectedDetail(null))
      .finally(() => setDetailLoading(false));
  };

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

  return (
    <StitchPageTransition>
      <StitchBackground />
      <div className="page" style={{ padding: '2rem', backgroundColor: 'transparent', minHeight: '100vh' }}>
        <div style={{ marginBottom: '2rem' }}>
          <Link to="/admin/analytics" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#78716c', fontSize: '0.85rem', textDecoration: 'none', marginBottom: '1rem' }}>
            <ArrowLeft size={14} /> Torna ad Analytics
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <CalendarDays size={32} className="text-gold-400" />
            <h1 style={{ margin: 0, fontSize: '2.5rem', color: '#fff', fontWeight: '900', letterSpacing: '-0.025em' }}>Calendario Storico</h1>
          </div>
          <p style={{ margin: 0, color: '#78716c', fontSize: '1.1rem' }}>Archivio giornaliero dei dati del sito, a partire da luglio 2026</p>
        </div>

        <StitchCard glowColor="blue" className="!p-5 sm:!p-6">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <button onClick={goPrevMonth} className="btn btn--ghost" style={{ padding: '0.5rem' }}>
              <ChevronLeft size={20} />
            </button>
            <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#f5f5f4', fontWeight: '800' }}>
              {MONTH_NAMES[month - 1]} {year}
            </h2>
            <button onClick={goNextMonth} className="btn btn--ghost" style={{ padding: '0.5rem' }}>
              <ChevronRight size={20} />
            </button>
          </div>

          {error && <p className="error-banner">{error}</p>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.4rem', marginBottom: '0.5rem' }}>
            {WEEKDAY_LABELS.map((w) => (
              <div key={w} style={{ textAlign: 'center', fontSize: '0.75rem', color: '#78716c', fontWeight: 'bold', padding: '0.25rem' }}>{w}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.4rem', opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
            {grid.map((dateStr, i) => {
              if (!dateStr) return <div key={`empty-${i}`} />;
              const dayData = daysByDate[dateStr];
              const visitors = dayData?.visitors || 0;
              const intensity = visitors > 0 ? Math.max(0.15, visitors / maxVisitors) : 0;
              const dayNum = parseInt(dateStr.slice(8, 10), 10);
              const isSelected = selectedDate === dateStr;
              return (
                <button
                  key={dateStr}
                  onClick={() => openDay(dateStr)}
                  style={{
                    aspectRatio: '1', borderRadius: '10px', border: isSelected ? '2px solid #d4af37' : '1px solid #292524',
                    backgroundColor: visitors > 0 ? `rgba(212,175,55, ${intensity})` : '#120f0a',
                    color: '#e7e5e4', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: '0.15rem', padding: '0.25rem',
                    transition: 'transform 0.15s',
                  }}
                  title={dayData ? `${visitors} visitatori, ${dayData.sessions} sessioni` : 'Nessun dato'}
                >
                  <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{dayNum}</span>
                  {visitors > 0 && <span style={{ fontSize: '0.65rem', color: '#e4c159' }}>{visitors}</span>}
                </button>
              );
            })}
          </div>
        </StitchCard>

        {selectedDate && (
          <div
            onClick={() => setSelectedDate(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: '100%', maxWidth: '480px', backgroundColor: '#120f0a', border: '1px solid #292524', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ margin: 0, color: '#f5f5f4', fontSize: '1.2rem' }}>{selectedDate}</h3>
                <button onClick={() => setSelectedDate(null)} style={{ background: 'rgba(22, 19, 14,0.8)', border: '1px solid #44403c', borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a8a29e', cursor: 'pointer' }}>
                  <X size={16} />
                </button>
              </div>

              {detailLoading ? (
                <p className="muted animate-pulse">Caricamento...</p>
              ) : !selectedDetail ? (
                <p style={{ color: '#78716c' }}>Nessun dato disponibile per questo giorno.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    {[
                      ['Visitatori', selectedDetail.visitors],
                      ['Sessioni', selectedDetail.sessions],
                      ['Durata Media', formatDuration(selectedDetail.avg_duration_seconds)],
                      ['Pagine Viste', selectedDetail.pageviews],
                      ['Nuove Registrazioni', selectedDetail.new_registrations],
                      ['Accessi', selectedDetail.logins],
                      ['Abbandonati', selectedDetail.bounced_visitors],
                    ].map(([label, value]) => (
                      <div key={label} style={{ backgroundColor: '#292524', borderRadius: '10px', padding: '0.75rem' }}>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: '#a8a29e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.3rem', fontWeight: 'bold', color: '#f5f5f4' }}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {selectedDetail.countries?.length > 0 && (
                    <div>
                      <p style={{ margin: '0.5rem 0 0.5rem 0', fontSize: '0.8rem', color: '#a8a29e' }}>Paesi</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {selectedDetail.countries.map((c) => (
                          <div key={c.country} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                            {c.country !== '??' ? (
                              <span className={`fi fi-${c.country.toLowerCase()}`} style={{ fontSize: '1rem', borderRadius: '2px' }} />
                            ) : (
                              <span style={{ color: '#57534e' }}>—</span>
                            )}
                            <span style={{ color: '#d6d3d1', fontWeight: 'bold' }}>{c.country}</span>
                            <span style={{ color: '#78716c', marginLeft: 'auto' }}>{c.visitors}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </StitchPageTransition>
  );
}

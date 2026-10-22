import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Ban, Check, FlaskConical, Loader2, MessageSquareWarning, Plus, Search, ShieldCheck, VolumeX, X } from 'lucide-react';
import { apiFetch } from '../api';

// Moderation of the typed plaza chat of CardBrix the game (src/routes/adminGameChat.js). Admin pages are Italian only,
// like the others in this folder.

const CATEGORY = {
  link: 'Link esterno', phone: 'Numero di telefono', email: 'Email', banned_word: 'Parola vietata', blasphemy: 'Bestemmia',
  violence: 'Violenza', insult: 'Insulto', contact: 'Contatto fuori sito', sexual: 'Contenuto sessuale', custom_rule: 'Regola del sito',
};
const REASON = {
  empty: 'Il messaggio è vuoto.', too_long: 'Il messaggio supera la lunghezza massima.', unavailable: 'L\'AI non ha risposto: in piazza il messaggio verrebbe bloccato.',
};

const NUMBERS = [
  { key: 'max_length', label: 'Lunghezza massima', unit: 'caratteri', help: 'Oltre questa lunghezza il messaggio non parte.' },
  { key: 'strike_threshold', label: 'Blocchi prima del silenziamento', unit: 'messaggi', help: 'Quanti messaggi bloccati...' },
  { key: 'strike_window_minutes', label: '...entro', unit: 'minuti', help: '...in questo intervallo silenziano il giocatore.' },
  { key: 'mute_minutes', label: 'Durata del silenziamento automatico', unit: 'minuti' },
  { key: 'ai_daily_limit', label: 'Controlli AI al giorno (tutto il sito)', unit: 'messaggi', help: 'Oltre il limite i messaggi scritti si fermano fino al giorno dopo.' },
  { key: 'log_retention_days', label: 'Conservazione dei messaggi bloccati', unit: 'giorni', help: 'Dopo questo periodo vengono cancellati.' },
];
const MUTE_OPTIONS = [[15, '15 minuti'], [60, '1 ora'], [1440, '1 giorno'], [10080, '7 giorni'], [43200, '30 giorni']];
const PAGE = 50;
const PRIVACY_RETENTION_DAYS = 30; // what the privacy policy states (locales privacy.s9_body)

const card = 'rounded-2xl border border-stone-800 bg-[#120f0a] p-4 sm:p-5';
const input = 'w-full rounded-xl border border-stone-700 bg-black/30 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-gold-500';
const saveBtn = 'inline-flex min-w-[84px] items-center justify-center gap-1.5 rounded-xl bg-gold-500 px-3 py-2 text-xs font-black uppercase tracking-wider text-white transition-colors hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-40';
const ghostBtn = 'inline-flex items-center justify-center gap-1.5 rounded-xl border border-stone-700 px-3 py-2 text-xs font-bold text-stone-300 transition-colors hover:border-stone-500 hover:text-white disabled:opacity-40';
const smallBtn = `${ghostBtn} px-2.5 py-1.5 text-[11px]`;
const fmt = (d) => new Date(d).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

function Section({ icon, title, children, aside }) {
  return (
    <section className={card}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-black text-white sm:text-lg">{icon} {title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Toggle({ checked, onChange, disabled, label, help }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm font-bold text-white">{label}</p>
        {help ? <p className="mt-0.5 text-xs text-stone-500">{help}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${checked ? 'border-emerald-400/60 bg-emerald-500/30' : 'border-stone-700 bg-stone-800'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? 'left-6' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

export default function AdminGameChat() {
  const [data, setData] = useState(null); // { settings, defaults, ranges, updatedAt, terms, mutes }
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(null); // key being saved
  const [drafts, setDrafts] = useState({});
  const [rulesDraft, setRulesDraft] = useState(null);
  const [newTerm, setNewTerm] = useState('');
  const [termFilter, setTermFilter] = useState('');
  const [preview, setPreview] = useState({ text: '', busy: false, result: null });
  const [muteForm, setMuteForm] = useState({ username: '', minutes: 60 });
  const [log, setLog] = useState({ rows: [], total: 0, userId: null, username: null, loading: false });

  const flash = (text) => { setNotice(text); setTimeout(() => setNotice((n) => (n === text ? '' : n)), 2500); };
  const failed = (err, fallback) => setError(err?.data?.error || fallback);

  const load = useCallback(async () => {
    try {
      setData(await apiFetch('/api/admin/game-chat'));
      setError('');
    } catch (err) {
      failed(err, 'Errore nel caricamento della moderazione chat. La migrazione è stata eseguita?');
    }
  }, []);

  const loadLog = useCallback(async ({ offset = 0, userId = null, username = null } = {}) => {
    setLog((l) => ({ ...l, loading: true }));
    try {
      const q = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
      if (userId) q.set('userId', userId);
      const r = await apiFetch(`/api/admin/game-chat/log?${q}`);
      setLog((l) => ({ rows: offset ? [...l.rows, ...r.rows] : r.rows, total: r.total, userId, username, loading: false }));
    } catch (err) {
      setLog((l) => ({ ...l, loading: false }));
      failed(err, 'Errore nel caricamento del registro.');
    }
  }, []);

  useEffect(() => { load(); loadLog(); }, [load, loadLog]);

  async function saveSetting(key, value, label) {
    setSaving(key);
    setError('');
    try {
      const r = await apiFetch(`/api/admin/game-chat/settings/${key}`, { method: 'PUT', body: { value } });
      setData((d) => ({ ...d, settings: { ...d.settings, [key]: r.value }, updatedAt: { ...d.updatedAt, [key]: new Date().toISOString() } }));
      setDrafts((d) => { const next = { ...d }; delete next[key]; return next; });
      if (key === 'custom_rules') setRulesDraft(null);
      flash(`${label}: salvato.`);
    } catch (err) {
      failed(err, 'Errore nel salvataggio.');
    } finally {
      setSaving(null);
    }
  }

  async function addTerm(e) {
    e.preventDefault();
    if (!newTerm.trim()) return;
    setSaving('term');
    setError('');
    try {
      const row = await apiFetch('/api/admin/game-chat/terms', { method: 'POST', body: { term: newTerm } });
      setData((d) => ({ ...d, terms: [...d.terms, row].sort((a, b) => a.term.localeCompare(b.term)) }));
      setNewTerm('');
      flash(`Aggiunta: ${row.term}`);
    } catch (err) {
      failed(err, 'Errore nell\'aggiunta della parola.');
    } finally {
      setSaving(null);
    }
  }

  async function removeTerm(t) {
    setError('');
    try {
      await apiFetch(`/api/admin/game-chat/terms/${t.id}`, { method: 'DELETE' });
      setData((d) => ({ ...d, terms: d.terms.filter((x) => x.id !== t.id) }));
      flash(`Rimossa: ${t.term}`);
    } catch (err) {
      failed(err, 'Errore nella rimozione della parola.');
    }
  }

  async function runPreview(e) {
    e.preventDefault();
    if (!preview.text.trim()) return;
    setPreview((p) => ({ ...p, busy: true, result: null }));
    try {
      const result = await apiFetch('/api/admin/game-chat/preview', { method: 'POST', body: { text: preview.text } });
      setPreview((p) => ({ ...p, busy: false, result }));
    } catch (err) {
      setPreview((p) => ({ ...p, busy: false }));
      failed(err, 'Errore nella prova del messaggio.');
    }
  }

  async function mute(username, minutes) {
    setSaving('mute');
    setError('');
    try {
      const r = await apiFetch('/api/admin/game-chat/mutes', { method: 'POST', body: { username, minutes } });
      setData((d) => ({ ...d, mutes: [r, ...d.mutes.filter((m) => m.user_id !== r.user_id)] }));
      setMuteForm((f) => ({ ...f, username: '' }));
      flash(`${r.username} silenziato fino a ${fmt(r.muted_until)}.`);
    } catch (err) {
      failed(err, 'Errore nel silenziamento.');
    } finally {
      setSaving(null);
    }
  }

  async function unmute(m) {
    setError('');
    try {
      await apiFetch(`/api/admin/game-chat/mutes/${m.user_id}`, { method: 'DELETE' });
      setData((d) => ({ ...d, mutes: d.mutes.filter((x) => x.user_id !== m.user_id) }));
      flash(`${m.username} può di nuovo scrivere.`);
    } catch (err) {
      failed(err, 'Errore nella rimozione del silenziamento.');
    }
  }

  const terms = useMemo(() => {
    const q = termFilter.trim().toLowerCase();
    return (data?.terms || []).filter((t) => !q || t.term.includes(q));
  }, [data, termFilter]);

  if (!data) {
    return (
      <div className="mx-auto max-w-[900px] p-4 sm:p-6">
        {error
          ? <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>
          : <div className="flex min-h-[50vh] items-center justify-center text-stone-400"><Loader2 className="mr-3 animate-spin" /> Caricamento...</div>}
      </div>
    );
  }

  const s = data.settings;
  const rules = rulesDraft ?? s.custom_rules.join('\n');
  const rulesList = rules.split('\n').map((r) => r.trim()).filter(Boolean);
  const rulesDirty = rulesDraft != null && rulesList.join('\n') !== s.custom_rules.join('\n');

  return (
    <div className="mx-auto max-w-[900px] space-y-5 p-4 sm:p-6">
      <div>
        <Link to="/admin" className="mb-2 flex items-center gap-2 text-sm text-stone-400 transition-colors hover:text-white"><ArrowLeft size={16} /> Dashboard</Link>
        <h1 className="flex items-center gap-2 text-2xl font-black uppercase tracking-tighter text-white sm:text-3xl">
          <MessageSquareWarning className="text-gold-400" /> Moderazione chat del gioco
        </h1>
        <p className="text-sm text-stone-400 sm:text-base">
          I messaggi scritti nella piazza di CardBrix the game vengono controllati prima che qualcuno li veda: prima le regole fisse (link, telefoni, email, parole vietate), poi l'AI (Gemini) con le tue regole. Le modifiche valgono subito.
        </p>
      </div>

      {error ? <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400" role="alert">{error}</div> : null}
      {notice ? <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-emerald-500/30 bg-[#0f1a12] px-4 py-2 text-sm text-emerald-300 shadow-2xl" role="status">{notice}</div> : null}

      <Section icon={<ShieldCheck size={18} className="text-gold-400" aria-hidden />} title="Stato">
        <div className="divide-y divide-stone-800/60">
          <Toggle
            label="Messaggi scritti in piazza"
            help={s.free_text_enabled ? 'Attivi: i giocatori possono scrivere. Spegnendoli restano solo le frasi veloci.' : 'Spenti: i giocatori usano solo frasi veloci ed emoji.'}
            checked={s.free_text_enabled}
            disabled={saving === 'free_text_enabled'}
            onChange={(v) => saveSetting('free_text_enabled', v, 'Messaggi scritti')}
          />
          <Toggle
            label="Controllo con l'AI (Gemini)"
            help={s.ai_enabled ? 'Attivo: blocca anche bestemmie creative, insulti, minacce e contatti mascherati.' : 'Spento: valgono solo le regole fisse. Insulti e bestemmie fuori elenco passano.'}
            checked={s.ai_enabled}
            disabled={saving === 'ai_enabled'}
            onChange={(v) => saveSetting('ai_enabled', v, 'Controllo AI')}
          />
        </div>
        {s.free_text_enabled && !s.ai_enabled ? (
          <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">Attenzione: messaggi attivi senza AI. Solo l'elenco di parole e le regole fisse proteggono la chat.</p>
        ) : null}
      </Section>

      <Section icon={<FlaskConical size={18} className="text-gold-400" aria-hidden />} title="Prova un messaggio">
        <form onSubmit={runPreview} className="flex flex-col gap-2 sm:flex-row">
          <input className={input} value={preview.text} maxLength={1000} placeholder="Es. scrivimi su insta come mario_99" onChange={(e) => setPreview({ text: e.target.value, busy: false, result: null })} aria-label="Messaggio da provare" />
          <button type="submit" className={ghostBtn} disabled={preview.busy || !preview.text.trim()}>
            {preview.busy ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />} Prova
          </button>
        </form>
        {preview.result ? (
          <p className={`mt-3 rounded-xl p-3 text-sm ${preview.result.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`} role="status">
            {preview.result.ok
              ? 'Passa: in piazza verrebbe mostrato.'
              : preview.result.reason === 'blocked'
                ? `Bloccato (${preview.result.source === 'ai' ? 'AI' : 'regola fissa'}): ${CATEGORY[preview.result.category] || preview.result.category}${preview.result.detail ? ` — ${preview.result.detail}` : ''}`
                : REASON[preview.result.reason] || 'Non passerebbe.'}
          </p>
        ) : <p className="mt-2 text-xs text-stone-500">Nessun registro e nessuna sanzione: serve a provare le regole, anche con i messaggi spenti.</p>}
      </Section>

      <Section icon={<ShieldCheck size={18} className="text-gold-400" aria-hidden />} title="Regole per l'AI" aside={<span className="text-xs text-stone-500">{rulesList.length}/30</span>}>
        <p className="mb-2 text-xs text-stone-500">Una regola per riga, in parole semplici. Si aggiungono a quelle fisse (bestemmie, violenza, insulti, contatti, contenuti sessuali). Es. "Niente vendite o pagamenti fuori da CardBrix".</p>
        <textarea className={`${input} min-h-[120px] resize-y`} value={rules} onChange={(e) => setRulesDraft(e.target.value)} aria-label="Regole per l'AI" />
        <div className="mt-2 flex justify-end">
          <button type="button" className={saveBtn} disabled={!rulesDirty || saving === 'custom_rules'} onClick={() => saveSetting('custom_rules', rulesList, 'Regole AI')}>
            {saving === 'custom_rules' ? <Loader2 size={14} className="animate-spin" /> : 'Salva'}
          </button>
        </div>
      </Section>

      <Section icon={<Ban size={18} className="text-gold-400" aria-hidden />} title="Parole vietate" aside={<span className="text-xs text-stone-500">{data.terms.length} parole</span>}>
        <p className="mb-3 text-xs text-stone-500">
          Contano solo parole intere; maiuscole, accenti, numeri al posto delle lettere (p0rc0), lettere ripetute e spazi tra le lettere vengono ignorati. Un * finale vale anche per le parole più lunghe: "stronz*" blocca stronzo, stronza, stronzata. Più parole insieme: "porco dio".
        </p>
        <form onSubmit={addTerm} className="mb-3 flex flex-col gap-2 sm:flex-row">
          <input className={input} value={newTerm} maxLength={80} placeholder="Nuova parola o frase" onChange={(e) => setNewTerm(e.target.value)} aria-label="Nuova parola vietata" />
          <button type="submit" className={saveBtn} disabled={!newTerm.trim() || saving === 'term'}>
            {saving === 'term' ? <Loader2 size={14} className="animate-spin" /> : <><Plus size={14} /> Aggiungi</>}
          </button>
        </form>
        <label className="relative mb-3 block">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" aria-hidden />
          <input className={`${input} pl-8`} value={termFilter} placeholder="Cerca nell'elenco" onChange={(e) => setTermFilter(e.target.value)} aria-label="Cerca nelle parole vietate" />
        </label>
        <ul className="flex max-h-72 flex-wrap gap-1.5 overflow-y-auto">
          {terms.map((t) => (
            <li key={t.id} className="inline-flex items-center gap-1 rounded-lg border border-stone-700 bg-black/30 py-1 pl-2.5 pr-1 text-xs text-stone-200">
              {t.term}
              <button type="button" onClick={() => removeTerm(t)} className="rounded p-1 text-stone-500 hover:bg-red-500/10 hover:text-red-400" aria-label={`Rimuovi ${t.term}`}><X size={12} /></button>
            </li>
          ))}
          {!terms.length ? <li className="text-xs text-stone-500">Nessuna parola.</li> : null}
        </ul>
      </Section>

      <Section icon={<VolumeX size={18} className="text-gold-400" aria-hidden />} title="Limiti e sanzioni">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {NUMBERS.map(({ key, label, unit, help }) => {
            const saved = String(s[key]);
            const draft = drafts[key] ?? saved;
            const n = Number(draft);
            const [min, max] = data.ranges[key];
            const valid = Number.isInteger(n) && n >= min && n <= max;
            return (
              <div key={key}>
                <label htmlFor={`gc-${key}`} className="text-sm font-bold text-white">{label}</label>
                <div className="mt-1 flex items-center gap-2">
                  <input id={`gc-${key}`} type="number" inputMode="numeric" min={min} max={max} className={`${input.replace('w-full ', '')} w-24 shrink-0 text-right`} value={draft} onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))} />
                  <span className="text-xs text-stone-500">{unit}</span>
                  <button type="button" className={`${saveBtn} ml-auto`} disabled={draft === saved || !valid || saving === key} onClick={() => saveSetting(key, n, label)}>
                    {saving === key ? <Loader2 size={14} className="animate-spin" /> : 'Salva'}
                  </button>
                </div>
                <p className={`mt-1 text-[11px] ${valid ? 'text-stone-500' : 'text-amber-400'}`}>
                  {valid ? `${help ? `${help} ` : ''}Predefinito: ${data.defaults[key]}.` : `Da ${min} a ${max}.`}
                </p>
                {key === 'log_retention_days' && s[key] !== PRIVACY_RETENTION_DAYS ? (
                  <p className="mt-1 text-[11px] text-amber-400">La privacy policy dice {PRIVACY_RETENTION_DAYS} giorni: aggiornala se cambi questo valore.</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </Section>

      <Section icon={<VolumeX size={18} className="text-gold-400" aria-hidden />} title="Giocatori silenziati" aside={<span className="text-xs text-stone-500">{data.mutes.length} ora</span>}>
        <form onSubmit={(e) => { e.preventDefault(); mute(muteForm.username, muteForm.minutes); }} className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
          <input className={input} value={muteForm.username} placeholder="Nome utente" onChange={(e) => setMuteForm((f) => ({ ...f, username: e.target.value }))} aria-label="Nome utente da silenziare" />
          <select className={input} value={muteForm.minutes} onChange={(e) => setMuteForm((f) => ({ ...f, minutes: Number(e.target.value) }))} aria-label="Durata">
            {MUTE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button type="submit" className={saveBtn} disabled={!muteForm.username.trim() || saving === 'mute'}>
            {saving === 'mute' ? <Loader2 size={14} className="animate-spin" /> : 'Silenzia'}
          </button>
        </form>
        <ul className="divide-y divide-stone-800/60">
          {data.mutes.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center gap-2 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white">{m.username}</p>
                <p className="text-[11px] text-stone-500">Fino a {fmt(m.muted_until)} · {m.reason === 'admin' ? 'da un admin' : 'automatico'}</p>
              </div>
              <button type="button" className={ghostBtn} onClick={() => loadLog({ userId: m.user_id, username: m.username })}>Messaggi</button>
              <button type="button" className={ghostBtn} onClick={() => unmute(m)}><Check size={14} /> Riattiva</button>
            </li>
          ))}
          {!data.mutes.length ? <li className="py-2 text-xs text-stone-500">Nessun giocatore silenziato.</li> : null}
        </ul>
      </Section>

      <Section
        icon={<MessageSquareWarning size={18} className="text-gold-400" aria-hidden />}
        title="Messaggi bloccati"
        aside={<span className="text-xs text-stone-500">{log.total} {log.username ? `di ${log.username}` : 'in totale'}</span>}
      >
        {log.username ? (
          <button type="button" className={`${ghostBtn} mb-3`} onClick={() => loadLog()}><X size={14} /> Mostra tutti</button>
        ) : null}
        <p className="mb-3 text-xs text-stone-500">Solo i messaggi bloccati, conservati {s.log_retention_days} giorni. Quelli accettati non vengono salvati.</p>
        <ul className="divide-y divide-stone-800/60">
          {log.rows.map((r) => (
            <li key={r.id} className="py-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                <span className="font-bold text-white">{r.username || 'utente eliminato'}</span>
                <span className="text-stone-500">{fmt(r.created_at)}</span>
                <span className="rounded-full bg-red-500/10 px-2 py-0.5 font-bold text-red-300">{CATEGORY[r.category] || r.category}</span>
                <span className="text-stone-500">{r.source === 'ai' ? 'AI' : 'regola fissa'}</span>
              </div>
              <p className="mt-1 break-words text-sm text-stone-200">{r.message}</p>
              {r.detail ? <p className="mt-0.5 break-words text-[11px] text-stone-500">{r.detail}</p> : null}
              {r.user_id ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {!log.userId ? <button type="button" className={smallBtn} onClick={() => loadLog({ userId: r.user_id, username: r.username })} title="Mostra solo i messaggi di questo utente">Filtra utente</button> : null}
                  {r.username ? <button type="button" className={smallBtn} disabled={saving === 'mute'} onClick={() => mute(r.username, 1440)}><VolumeX size={12} /> Silenzia 24h</button> : null}
                </div>
              ) : null}
            </li>
          ))}
          {!log.rows.length && !log.loading ? <li className="py-2 text-xs text-stone-500">Nessun messaggio bloccato.</li> : null}
        </ul>
        {log.rows.length < log.total ? (
          <button type="button" className={`${ghostBtn} mt-3 w-full`} disabled={log.loading} onClick={() => loadLog({ offset: log.rows.length, userId: log.userId, username: log.username })}>
            {log.loading ? <Loader2 size={14} className="animate-spin" /> : null} Mostra altri
          </button>
        ) : null}
      </Section>
    </div>
  );
}

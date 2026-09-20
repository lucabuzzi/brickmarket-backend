import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Coins, ImageOff, Swords, Trophy, Users, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatRaceTime } from '../../api';
import { formatEUR } from '../landing/landingUtils';
import { contestImage, gameName } from './arenaUtils';

const PODIUM = ['text-[#facc15]', 'text-[#e2e8f0]', 'text-[#d6955b]'];

function hideBrokenImage(e) {
  e.currentTarget.style.display = 'none';
  e.currentTarget.nextElementSibling?.classList.remove('hidden');
}

/* ────────────────────────────── Hero ────────────────────────────── */

export function ArenaHero({ contests, user, wallet, spotlight, spotlightLeaderboard, onPlay }) {
  const { t, i18n } = useTranslation();
  const reduceMotion = useReducedMotion();

  const open = contests.filter((c) => c.status === 'open');
  const stats = [
    { value: open.length, label: t('arena_page.hero.stat_open') },
    { value: formatEUR(open.reduce((s, c) => s + (Number(c.marketValue) || 0), 0), i18n.language).replace(/,00(?=\s?€)/, ''), label: t('arena_page.hero.stat_prizes') },
    { value: contests.reduce((s, c) => s + (c.filledSlots || 0), 0), label: t('arena_page.hero.stat_players') },
  ];

  return (
    <section className="lx-bleed relative overflow-hidden">
      <div className="lx-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="pointer-events-none absolute -left-40 top-10 h-[520px] w-[520px] rounded-full bg-[#8b5cf6]/25 blur-[130px]" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-[480px] w-[480px] rounded-full bg-[#22d3ee]/15 blur-[130px]" aria-hidden="true" />

      <div className="relative mx-auto grid max-w-[1320px] grid-cols-1 items-center gap-12 px-5 pb-16 pt-28 md:px-10 md:pt-36 lg:grid-cols-[1.1fr_0.9fr] lg:pb-24">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-[#22d3ee]">
            <Swords size={15} /> {t('arena_page.hero.kicker')}
          </p>
          <h1 className="mt-4 text-[clamp(2.7rem,9.5vw,6.4rem)] font-black leading-[0.88] tracking-[-0.055em] lg:text-[clamp(3rem,6vw,6.4rem)]">
            {['title_1', 'title_2', 'title_3'].map((k, i) => (
              <span key={k} className="block overflow-hidden pb-[0.08em]">
                <motion.span
                  className={`block ${i === 2 ? 'lx-text-arena' : 'text-white'}`}
                  initial={reduceMotion ? false : { y: '105%' }}
                  animate={{ y: 0 }}
                  transition={{ delay: 0.08 + i * 0.12, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                >
                  {t(`arena_page.hero.${k}`)}
                </motion.span>
              </span>
            ))}
          </h1>
          <p className="mt-6 max-w-[34rem] text-base leading-relaxed text-white/60 md:text-lg">{t('arena_page.hero.subtitle')}</p>

          <dl className="mt-8 grid max-w-[34rem] grid-cols-3 gap-2">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col-reverse rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 md:px-4">
                <dt className="mt-1 text-[11px] font-semibold leading-tight text-white/45">{s.label}</dt>
                <dd className="truncate font-mono text-xl font-black tabular-nums text-white md:text-2xl">{s.value}</dd>
              </div>
            ))}
          </dl>

          {user ? (
            <div className="mt-4 flex max-w-[34rem] flex-col gap-4 rounded-2xl border border-[#8b5cf6]/30 bg-[#8b5cf6]/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#8b5cf6] text-white"><Coins size={20} /></span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-white/50">{t('arena_page.hero.wallet_title')}</p>
                  <p className="font-mono text-2xl font-black tabular-nums text-white">{Number(wallet?.balanceCredits || 0).toFixed(2)} <span className="text-sm text-white/50">CR</span></p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Top-up crediti (Stripe) temporaneamente disattivato — vedi WalletInfo.jsx */}
                <Link to="/crediti" className="rounded-xl px-3 py-3 text-sm font-bold text-white/70 underline decoration-white/25 underline-offset-4 hover:text-white">
                  {t('arena_page.hero.wallet_how')}
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex max-w-[34rem] flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black text-white">{t('arena_page.hero.guest_title')}</p>
                <p className="mt-0.5 text-sm text-white/55">{t('arena_page.hero.guest_text')}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link to="/login" className="rounded-xl bg-white px-4 py-3 text-sm font-black text-[#07060b]">{t('arena_page.hero.guest_login')}</Link>
                <Link to="/register" className="rounded-xl border border-white/20 px-4 py-3 text-sm font-black text-white hover:border-white/50">{t('arena_page.hero.guest_register')}</Link>
              </div>
            </div>
          )}
        </div>

        <Spotlight contest={spotlight} leaderboard={spotlightLeaderboard} onPlay={onPlay} user={user} />
      </div>
    </section>
  );
}

function Spotlight({ contest, leaderboard, onPlay, user }) {
  const { t, i18n } = useTranslation();

  if (!contest) {
    return (
      <div className="relative flex aspect-[4/5] max-h-[560px] w-full flex-col items-center justify-center overflow-hidden rounded-[36px] border border-dashed border-white/15 p-8 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(139,92,246,0.25),transparent_60%)]" />
        <Trophy size={44} className="relative text-[#22d3ee]" />
        <p className="relative mt-5 text-2xl font-black text-white">{t('arena_page.spotlight.empty_title')}</p>
        <p className="relative mt-2 max-w-xs text-sm text-white/55">{t('arena_page.spotlight.empty_text')}</p>
      </div>
    );
  }

  const pct = contest.totalSlots ? Math.round((contest.filledSlots / contest.totalSlots) * 100) : 0;
  const left = Math.max(0, contest.totalSlots - contest.filledSlots);

  return (
    <div className="relative mx-auto w-full max-w-[520px]">
      <div className="lx-arena-ring pointer-events-none absolute -inset-3 rounded-[44px]" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[#100d18]">
        <div className="relative aspect-[5/4] overflow-hidden bg-black">
          <img src={contestImage(contest, 900)} alt={contest.title} className="h-full w-full object-cover" onError={hideBrokenImage} />
          <div className="hidden h-full w-full items-center justify-center text-white/30"><ImageOff size={40} /></div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#100d18] via-[#100d18]/20 to-transparent" />
          <span className="absolute left-4 top-4 rounded-full bg-[#22d3ee] px-3 py-1.5 text-xs font-black uppercase text-[#06222a]">
            {pct >= 70 ? t('arena_page.spotlight.almost_full') : t('arena_page.spotlight.kicker')}
          </span>
          <span className="absolute right-4 top-4 rounded-full bg-black/70 px-3 py-1.5 font-mono text-xs font-black text-white backdrop-blur-md">
            {t('arena_page.card.value', { value: formatEUR(contest.marketValue, i18n.language) })}
          </span>
          <div className="absolute inset-x-5 bottom-4">
            <p className="text-xs font-bold uppercase tracking-wider text-white/60">{gameName(contest.category)}</p>
            <h2 className="mt-1 line-clamp-2 text-2xl font-black leading-tight tracking-[-0.02em] text-white md:text-3xl">{contest.title}</h2>
          </div>
        </div>

        <div className="p-5 md:p-6">
          <SlotsBar contest={contest} pct={pct} left={left} />
          {leaderboard.length ? (
            <ol className="mt-5 space-y-1.5">
              {leaderboard.slice(0, 3).map((ld, i) => (
                <li key={ld.id} className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2 text-sm">
                  <Trophy size={14} className={PODIUM[i]} />
                  <span className="min-w-0 flex-1 truncate font-bold text-white">{ld.username}</span>
                  <LeaderTime ld={ld} />
                </li>
              ))}
            </ol>
          ) : null}
          <button
            type="button"
            onClick={() => onPlay(contest)}
            className="group mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#8b5cf6] to-[#22d3ee] px-6 py-4 text-base font-black text-white transition-transform hover:-translate-y-0.5"
          >
            {user ? t('arena_page.card.cta_buy', { cost: contest.slotCostCredits }) : t('arena_page.card.cta_login')}
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────── Steps ────────────────────────────── */

export function ArenaSteps() {
  const { t } = useTranslation();
  const steps = [
    { icon: Coins, key: 'step1', to: '/crediti' },
    { icon: Zap, key: 'step2' },
    { icon: Trophy, key: 'step3' },
  ];

  return (
    <section className="lx-bleed relative py-14 md:py-20">
      <div className="mx-auto max-w-[1320px] px-5 md:px-10">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#22d3ee]">{t('arena_page.steps.kicker')}</p>
        <h2 className="mt-3 text-[clamp(2rem,5vw,3.6rem)] font-black leading-[0.95] tracking-[-0.045em] text-white">{t('arena_page.steps.title')}</h2>
        <ol className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-3">
          {steps.map(({ icon: Icon, key, to }, i) => (
            <li key={key} className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#100d18] p-6 md:p-7">
              <span className="pointer-events-none absolute -right-2 -top-6 select-none font-mono text-[7rem] font-black leading-none text-white/[0.04]" aria-hidden="true">{i + 1}</span>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8b5cf6] to-[#22d3ee] text-white"><Icon size={22} /></span>
              <p className="mt-6 text-lg font-black text-white">{t(`arena_page.steps.${key}_title`)}</p>
              <p className="mt-2 text-sm leading-relaxed text-white/55">{t(`arena_page.steps.${key}_text`)}</p>
              {to ? (
                <Link to={to} className="-my-2 mt-3 inline-flex items-center gap-1.5 py-2 text-sm font-bold text-[#22d3ee] hover:underline">
                  {t('arena_page.hero.wallet_how')} <ArrowRight size={14} />
                </Link>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ────────────────────────────── Contest card ────────────────────────────── */

function SlotsBar({ contest, pct, left }) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-[#8b5cf6] to-[#22d3ee] transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-xs font-bold">
        <span className="flex items-center gap-1.5 text-white/60">
          <Users size={13} />
          {contest.status === 'open'
            ? t('landing.arena.contest_slots_left', { count: left, total: contest.totalSlots })
            : t('arena_page.card.full')}
        </span>
        <span className="font-mono text-white/80">{t('arena_page.card.cost', { count: contest.slotCostCredits })}</span>
      </div>
    </div>
  );
}

function LeaderTime({ ld }) {
  const { t } = useTranslation();
  if (ld.status === 'completed') return <span className="font-mono text-xs font-black tabular-nums text-[#22d3ee]">{formatRaceTime(ld.totalTimeMs)}</span>;
  if (ld.status === 'cheated') return <span className="text-[11px] font-bold uppercase text-[#ff5a36]">{t('skill_zone.lobby.void')}</span>;
  return <span className="text-[11px] font-bold text-white/40">{t('skill_zone.lobby.pending')}</span>;
}

export function ContestCard({ contest, leaderboard, user, onPlay, index }) {
  const { t, i18n } = useTranslation();
  const reduceMotion = useReducedMotion();
  const isOpen = contest.status === 'open';
  const pct = contest.totalSlots ? Math.min(100, Math.round((contest.filledSlots / contest.totalSlots) * 100)) : 0;
  const left = Math.max(0, contest.totalSlots - contest.filledSlots);
  const isParticipating = !!user && leaderboard.some((p) => p.userId === user.id);

  const cta = !isOpen
    ? t('arena_page.card.cta_full')
    : !user
      ? t('arena_page.card.cta_login')
      : isParticipating
        ? t('arena_page.card.cta_again', { cost: contest.slotCostCredits })
        : t('arena_page.card.cta_buy', { cost: contest.slotCostCredits });

  return (
    <motion.article
      initial={reduceMotion ? false : { y: 24 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay: Math.min(index, 6) * 0.05, ease: [0.16, 1, 0.3, 1] }}
      onClick={() => onPlay(contest)}
      className={`group flex cursor-pointer flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#100d18] transition-all duration-300 hover:-translate-y-1 hover:border-[#8b5cf6]/60 ${isOpen ? '' : 'opacity-80'}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-black">
        <img
          src={contestImage(contest, 640)}
          alt={contest.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
          onError={hideBrokenImage}
        />
        <div className="hidden h-full w-full items-center justify-center text-white/30"><ImageOff size={34} /></div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#100d18] via-transparent to-transparent" />
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${isOpen ? 'bg-[#22d3ee] text-[#06222a]' : 'bg-white/15 text-white'}`}>
            {isOpen ? t('arena_page.card.open') : t('arena_page.card.full')}
          </span>
          <span className="rounded-full bg-black/70 px-2.5 py-1 font-mono text-[11px] font-black text-white backdrop-blur-md">
            {t('arena_page.card.value', { value: formatEUR(contest.marketValue, i18n.language) })}
          </span>
        </div>
        <p className="absolute bottom-3 left-4 text-[11px] font-bold uppercase tracking-wider text-white/70">{gameName(contest.category)}</p>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="line-clamp-2 text-lg font-black leading-tight tracking-[-0.01em] text-white">{contest.title}</h3>
        <p className="mt-1 truncate text-xs font-medium text-white/45">
          {[contest.condition, contest.gradingInfo].filter(Boolean).join(' · ') || t('skill_zone.lobby.condition_fallback')}
        </p>

        <div className="mt-4"><SlotsBar contest={contest} pct={pct} left={left} /></div>

        <div className="mt-4 rounded-2xl bg-white/[0.03] p-3">
          <p className="mb-2 flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-white/45">
            {t('skill_zone.lobby.leaderboard')} <Trophy size={13} className="text-[#facc15]" />
          </p>
          {leaderboard.length === 0 ? (
            <p className="py-2 text-center text-xs text-white/40">{t('skill_zone.lobby.no_attempts')}</p>
          ) : (
            <ol className="space-y-1">
              {leaderboard.slice(0, 3).map((ld, i) => (
                <li key={ld.id} className="flex items-center gap-2 text-sm">
                  <span className={`w-4 font-mono text-xs font-black ${PODIUM[i]}`}>{i + 1}</span>
                  <span className={`min-w-0 flex-1 truncate font-bold ${user && ld.userId === user.id ? 'text-[#22d3ee]' : 'text-white/85'}`}>{ld.username}</span>
                  <LeaderTime ld={ld} />
                </li>
              ))}
            </ol>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPlay(contest); }}
          disabled={!isOpen}
          className="mt-5 w-full rounded-2xl bg-gradient-to-r from-[#8b5cf6] to-[#22d3ee] px-4 py-3.5 text-sm font-black text-white transition-transform enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:from-white/10 disabled:to-white/10 disabled:text-white/50"
        >
          {cta}
        </button>
      </div>
    </motion.article>
  );
}

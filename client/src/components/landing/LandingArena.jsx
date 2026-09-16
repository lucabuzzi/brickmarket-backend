import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, RotateCcw, Shuffle, Trophy, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cldImage, formatEUR, pad2 } from './landingUtils';

const SIZE = 3;
const TILE_COUNT = SIZE * SIZE;
const SOLVED = Array.from({ length: TILE_COUNT }, (_, i) => i);

function shuffled() {
  let order;
  do {
    order = [...SOLVED];
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
  } while (order.every((tile, i) => tile === i));
  return order;
}

function MiniPuzzle({ image }) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const [order, setOrder] = useState(shuffled);
  const [selected, setSelected] = useState(null);
  const [moves, setMoves] = useState(0);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const solved = order.every((tile, i) => tile === i);

  useEffect(() => {
    if (!running || solved) return undefined;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [running, solved]);

  const reset = () => {
    setOrder(shuffled());
    setSelected(null);
    setMoves(0);
    setRunning(false);
    setElapsed(0);
  };

  const handleTile = (position) => {
    if (solved) return;
    if (!running) setRunning(true);
    if (selected === null) {
      setSelected(position);
      return;
    }
    if (selected !== position) {
      setOrder((prev) => {
        const next = [...prev];
        [next[selected], next[position]] = [next[position], next[selected]];
        return next;
      });
      setMoves((m) => m + 1);
    }
    setSelected(null);
  };

  const clock = `${pad2(Math.floor(elapsed / 60))}:${pad2(elapsed % 60)}`;

  return (
    <div className="rounded-[28px] border border-white/10 bg-[#0e0b16] p-4 md:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex gap-4 font-mono text-sm font-bold tabular-nums text-white/70">
          <span>{t('landing.arena.puzzle_time')} <span className="text-white">{clock}</span></span>
          <span>{t('landing.arena.puzzle_moves')} <span className="text-white">{moves}</span></span>
        </div>
        <button
          type="button"
          onClick={reset}
          className="flex min-h-[40px] items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-2 text-xs font-bold text-white/80 transition-colors hover:border-[#22d3ee] hover:text-[#22d3ee]"
        >
          <Shuffle size={13} /> {t('landing.arena.puzzle_shuffle')}
        </button>
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-[440px]">
        <div className="grid h-full w-full grid-cols-3 gap-1.5">
          {order.map((tile, position) => {
            const row = Math.floor(tile / SIZE);
            const col = tile % SIZE;
            const isSelected = selected === position;
            const inPlace = tile === position;
            return (
              <motion.button
                key={tile}
                layout={!reduceMotion}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                type="button"
                onClick={() => handleTile(position)}
                aria-label={t('landing.arena.puzzle_tile', { n: position + 1 })}
                aria-pressed={isSelected}
                className={`relative overflow-hidden rounded-lg bg-[#1a1526] outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-[#22d3ee] ${
                  isSelected ? 'z-10 ring-[3px] ring-[#22d3ee] shadow-[0_0_30px_rgba(34,211,238,0.6)]' : ''
                } ${solved ? 'rounded-none' : ''}`}
              >
                <img
                  src={image}
                  alt=""
                  draggable="false"
                  className="pointer-events-none absolute max-w-none select-none object-cover"
                  style={{ width: '300%', height: '300%', left: `${-col * 100}%`, top: `${-row * 100}%` }}
                />
                {!solved && inPlace && moves > 0 ? (
                  <span className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-[#c6ff3d] shadow-[0_0_8px_#c6ff3d]" />
                ) : null}
              </motion.button>
            );
          })}
        </div>

        <AnimatePresence>
          {solved ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={{ delay: reduceMotion ? 0 : 1.1, duration: 0.4 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-xl bg-[#07060b]/80 p-6 text-center backdrop-blur-[3px]"
            >
              <motion.span
                initial={reduceMotion ? false : { scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 14 }}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#22d3ee] text-white"
              >
                <Trophy size={30} />
              </motion.span>
              <p className="text-2xl font-black tracking-tight text-white">{t('landing.arena.puzzle_solved')}</p>
              <p className="font-mono text-sm font-bold text-white/70">
                {t('landing.arena.puzzle_result', { time: clock, count: moves })}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Link to="/skill-zone" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-[#07060b]">
                  {t('landing.arena.puzzle_play_real')} <ArrowUpRight size={16} />
                </Link>
                <button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-bold text-white">
                  <RotateCcw size={15} /> {t('landing.arena.puzzle_again')}
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <p className="mt-4 text-center text-xs font-medium text-white/45">{t('landing.arena.puzzle_hint')}</p>
    </div>
  );
}

function ContestRow({ contest }) {
  const { t, i18n } = useTranslation();
  const pct = contest.totalSlots ? Math.min(100, Math.round((contest.filledSlots / contest.totalSlots) * 100)) : 0;
  const left = Math.max(0, contest.totalSlots - contest.filledSlots);
  const isOpen = contest.status === 'open';

  return (
    <Link
      to="/skill-zone"
      className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition-all hover:-translate-y-0.5 hover:border-[#8b5cf6]/70 hover:bg-[#8b5cf6]/10"
    >
      <img src={cldImage(contest.imageUrl, 180)} alt="" loading="lazy" className="h-20 w-16 shrink-0 rounded-xl object-cover" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-bold text-white">{contest.title}</p>
        </div>
        <p className="mt-0.5 text-xs font-semibold text-white/45">
          {t('landing.arena.contest_value', { value: formatEUR(contest.marketValue, i18n.language) })}
          {' · '}
          {t('landing.arena.contest_cost', { count: contest.slotCostCredits })}
        </p>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-[#8b5cf6] to-[#22d3ee]" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-white/50">
          <Users size={12} />
          {isOpen
            ? t('landing.arena.contest_slots_left', { count: left, total: contest.totalSlots })
            : t('landing.arena.contest_full')}
        </p>
      </div>
      <span className={`shrink-0 rounded-xl px-3 py-2 text-xs font-black ${isOpen ? 'bg-[#8b5cf6] text-white' : 'bg-white/10 text-white/60'}`}>
        {isOpen ? t('landing.arena.contest_play') : t('landing.arena.contest_watch')}
      </span>
    </Link>
  );
}

export default function LandingArena({ contests, loading }) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const puzzleImage = contests.find((c) => c.imageUrl)?.imageUrl;
  const listed = [...contests]
    .sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1))
    .slice(0, 4);

  const steps = [1, 2, 3];

  return (
    <section className="lx-bleed relative overflow-hidden py-20 md:py-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,rgba(139,92,246,0.22),transparent_55%),radial-gradient(ellipse_at_90%_80%,rgba(34,211,238,0.14),transparent_55%)]" />
      <div className="relative mx-auto max-w-[1320px] px-5 md:px-10">
        <motion.div
          className="max-w-3xl"
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#22d3ee]">{t('landing.arena.kicker')}</p>
          <h2 className="mt-3 text-[clamp(2.4rem,6vw,4.6rem)] font-black leading-[0.9] tracking-[-0.05em]">
            <span className="text-white">{t('landing.arena.title_1')} </span>
            <span className="lx-text-arena">{t('landing.arena.title_2')}</span>
          </h2>
        </motion.div>

        <ol className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {steps.map((n) => (
            <li key={n} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <span className="font-mono text-3xl font-black leading-none text-[#8b5cf6]">{n}</span>
              <div>
                <p className="text-sm font-black text-white">{t(`landing.arena.step${n}_title`)}</p>
                <p className="mt-1 text-sm leading-relaxed text-white/55">{t(`landing.arena.step${n}_desc`)}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-12 grid grid-cols-1 items-start gap-8 lg:grid-cols-2 lg:gap-12">
          <div>
            <h3 className="text-2xl font-black tracking-[-0.02em] text-white">{t('landing.arena.puzzle_title')}</h3>
            <p className="mb-5 mt-2 text-sm leading-relaxed text-white/55">{t('landing.arena.puzzle_desc')}</p>
            {loading ? (
              <div className="aspect-square w-full max-w-[480px] animate-pulse rounded-[28px] bg-white/[0.04]" />
            ) : puzzleImage ? (
              <MiniPuzzle image={cldImage(puzzleImage, 900)} />
            ) : null}
          </div>

          <div>
            <div className="flex items-end justify-between gap-4">
              <h3 className="text-2xl font-black tracking-[-0.02em] text-white">{t('landing.arena.contests_title')}</h3>
              <Link to="/skill-zone" className="-my-3 inline-block shrink-0 py-3 text-sm font-bold text-[#22d3ee] underline decoration-[#22d3ee]/30 underline-offset-4 hover:decoration-[#22d3ee]">
                {t('landing.arena.contests_all')}
              </Link>
            </div>
            <div className="mt-5 flex flex-col gap-3">
              {loading
                ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-[104px] animate-pulse rounded-2xl bg-white/[0.04]" />)
                : listed.length
                  ? listed.map((c) => <ContestRow key={c.id} contest={c} />)
                  : <p className="rounded-2xl border border-dashed border-white/15 p-6 text-sm text-white/55">{t('landing.arena.contests_empty')}</p>}
            </div>
            <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-[#8b5cf6]/30 bg-[#8b5cf6]/10 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black text-white">{t('landing.arena.credits_title')}</p>
                <p className="text-sm text-white/60">{t('landing.arena.credits_desc')}</p>
              </div>
              <Link to="/crediti" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-[#07060b]">
                {t('landing.arena.credits_cta')} <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

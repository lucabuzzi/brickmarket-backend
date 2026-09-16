import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Check, Gavel, ShoppingBag, Swords } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const PILLARS = [
  {
    id: 'listings',
    icon: ShoppingBag,
    accent: '#c6ff3d',
    accentText: 'text-[#10140a]',
    to: '/annunci',
    secondaryTo: '/sell',
  },
  {
    id: 'auctions',
    icon: Gavel,
    accent: '#ff5a36',
    accentText: 'text-white',
    to: '/aste',
    secondaryTo: '/create-auction',
  },
  {
    id: 'arena',
    icon: Swords,
    accent: '#8b5cf6',
    accentText: 'text-white',
    to: '/skill-zone',
    secondaryTo: '/crediti',
  },
];

export default function LandingPillars({ images, stats, statsLoading }) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(0);

  const statFor = {
    listings: stats.listings,
    auctions: stats.auctions,
    arena: stats.contests,
  };

  return (
    <section className="lx-bleed relative py-20 md:py-28">
      <div className="mx-auto max-w-[1320px] px-5 md:px-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <motion.h2
            className="max-w-[16ch] text-[clamp(2.2rem,6vw,4.4rem)] font-black leading-[0.92] tracking-[-0.045em] text-white"
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            {t('landing.pillars.title')}
          </motion.h2>
          <p className="max-w-sm text-base leading-relaxed text-white/55">{t('landing.pillars.subtitle')}</p>
        </div>

        <div className="mt-12 flex flex-col gap-4 lg:h-[560px] lg:flex-row">
          {PILLARS.map((p, i) => {
            const Icon = p.icon;
            const isActive = active === i;
            const image = images[p.id];

            return (
              <motion.article
                key={p.id}
                onMouseEnter={() => setActive(i)}
                onFocusCapture={() => setActive(i)}
                className={`group relative flex min-h-[420px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#0f0d14] transition-[flex-grow,border-color] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] lg:min-h-0 lg:basis-0 ${isActive ? 'lg:grow-[2.3]' : 'lg:grow'}`}
                style={{ borderColor: isActive ? `${p.accent}66` : undefined }}
                initial={reduceMotion ? false : { opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ delay: i * 0.1, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              >
                {image ? (
                  <img
                    src={image}
                    alt=""
                    loading="lazy"
                    className={`absolute inset-0 h-full w-full object-cover opacity-30 transition-all duration-700 ${isActive ? 'lg:scale-105 lg:opacity-45' : 'lg:opacity-15'}`}
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0f0d14] via-[#0f0d14]/80 to-[#0f0d14]/30" />
                <div
                  className="absolute -right-24 -top-24 h-64 w-64 rounded-full blur-[90px] transition-opacity duration-700"
                  style={{ background: p.accent, opacity: isActive ? 0.35 : 0.12 }}
                />

                <div className="relative flex h-full flex-col p-6 md:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <span
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl ${p.accentText}`}
                      style={{ background: p.accent }}
                    >
                      <Icon size={22} strokeWidth={2.4} />
                    </span>
                    <span className="font-mono text-sm font-bold text-white/30">0{i + 1}</span>
                  </div>

                  <p className="mt-8 text-xs font-black uppercase tracking-[0.22em]" style={{ color: p.accent }}>
                    {t(`landing.pillars.${p.id}.kicker`)}
                  </p>
                  <h3 className="mt-2 text-3xl font-black tracking-[-0.03em] text-white md:text-4xl">
                    {t(`landing.pillars.${p.id}.name`)}
                  </h3>

                  <div className={`grid transition-all duration-700 ${isActive ? 'lg:grid-rows-[1fr] lg:opacity-100' : 'lg:pointer-events-none lg:grid-rows-[0fr] lg:opacity-0'}`}>
                    <div className="min-h-0 overflow-hidden">
                      <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/70">
                        {t(`landing.pillars.${p.id}.desc`)}
                      </p>
                      <ul className="mt-5 space-y-2">
                        {[1, 2, 3].map((n) => (
                          <li key={n} className="flex items-center gap-2.5 text-sm font-semibold text-white/80">
                            <Check size={15} strokeWidth={3} style={{ color: p.accent }} className="shrink-0" />
                            {t(`landing.pillars.${p.id}.fact${n}`)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-auto pt-8">
                    <p className="mb-4 flex items-baseline gap-2 text-white/50">
                      <span className="font-mono text-4xl font-black tabular-nums text-white">
                        {statsLoading ? '–' : statFor[p.id]}
                      </span>
                      <span className="text-sm font-semibold">{t(`landing.pillars.${p.id}.stat`)}</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        to={p.to}
                        className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-black transition-transform hover:-translate-y-0.5 ${p.accentText}`}
                        style={{ background: p.accent }}
                      >
                        {t(`landing.pillars.${p.id}.cta`)}
                        <ArrowUpRight size={17} strokeWidth={2.6} />
                      </Link>
                      <Link
                        to={p.secondaryTo}
                        className="rounded-xl px-3 py-3 text-sm font-bold text-white/60 underline decoration-white/20 underline-offset-4 transition-colors hover:text-white hover:decoration-white"
                      >
                        {t(`landing.pillars.${p.id}.secondary`)}
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

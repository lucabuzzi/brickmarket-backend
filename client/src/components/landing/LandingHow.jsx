import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, CreditCard, Package, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocalizedNav } from '../../routing/useLocalizedNav';

const STEPS = [
  { n: 1, icon: Search },
  { n: 2, icon: CreditCard },
  { n: 3, icon: Package },
];

export default function LandingHow() {
  const { t } = useTranslation();
  const navTo = useLocalizedNav();
  const reduceMotion = useReducedMotion();

  return (
    <section className="lx-bleed relative pb-4 pt-6 md:pt-10">
      <div className="mx-auto max-w-[1320px] px-5 md:px-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-2xl font-black tracking-[-0.03em] text-white md:text-3xl">{t('landing.how.title')}</h2>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm font-bold">
            <Link to={navTo('/sell')} className="text-[#c6ff3d] underline decoration-[#c6ff3d]/30 underline-offset-4 hover:decoration-[#c6ff3d]">
              {t('landing.how.sell')}
            </Link>
            <Link to={navTo('/come-funziona')} className="inline-flex items-center gap-1 text-white/60 hover:text-white">
              {t('landing.how.more')}
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <ol className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
          {STEPS.map(({ n, icon: Icon }, i) => (
            <motion.li
              key={n}
              className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#c6ff3d] text-[#10140a]">
                <Icon size={20} strokeWidth={2.4} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-mono text-xs font-bold text-white/35">0{n}</p>
                <h3 className="text-lg font-black text-white">{t(`landing.how.step${n}`)}</h3>
                <p className="mt-1 text-sm leading-relaxed text-white/60">{t(`landing.how.step${n}_desc`)}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}

import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, BadgeCheck, CreditCard, Gavel, LineChart, MessageSquareQuote, ShoppingBag, Swords } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/useAuth';

const TRUST = [
  { key: 'verified', icon: BadgeCheck },
  { key: 'reviews', icon: MessageSquareQuote },
  { key: 'payments', icon: CreditCard },
  { key: 'pricing', icon: LineChart, to: '/catalog' },
];

export default function LandingClosing() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();

  const primary = user
    ? { to: '/sell', label: t('landing.closing.cta_sell') }
    : { to: '/register', label: t('landing.closing.cta_register') };
  const secondary = user
    ? { to: '/create-auction', label: t('landing.closing.cta_auction') }
    : { to: '/login', label: t('landing.closing.cta_login') };

  return (
    <section className="lx-bleed relative pb-24 pt-8 md:pb-32">
      <div className="mx-auto max-w-[1320px] px-5 md:px-10">
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[28px] border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map(({ key, icon: Icon, to }) => {
            const body = (
              <>
                <Icon size={22} className="text-white" />
                <p className="mt-5 text-base font-black text-white">{t(`landing.trust.${key}_title`)}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-white/55">{t(`landing.trust.${key}_desc`)}</p>
                {to ? (
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[#c6ff3d]">
                    {t(`landing.trust.${key}_cta`)} <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                  </span>
                ) : null}
              </>
            );
            return to ? (
              <Link key={key} to={to} className="group bg-[#0d0b12] p-6 transition-colors hover:bg-[#15121c] md:p-8">{body}</Link>
            ) : (
              <div key={key} className="bg-[#0d0b12] p-6 md:p-8">{body}</div>
            );
          })}
        </div>

        <motion.div
          className="relative mt-16 overflow-hidden rounded-[36px] bg-[#f4f2ee] px-6 py-14 text-[#07060b] md:px-14 md:py-20"
          initial={reduceMotion ? false : { opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 flex h-3 md:inset-x-auto md:right-0 md:h-full md:w-1/3" aria-hidden="true">
            <span className="flex h-full flex-1 items-end justify-center bg-[#c6ff3d] pb-10 text-[#10140a]">
              <ShoppingBag size={34} strokeWidth={2.2} className="hidden md:block" />
            </span>
            <span className="flex h-full flex-1 items-end justify-center bg-[#ff5a36] pb-10 text-white">
              <Gavel size={34} strokeWidth={2.2} className="hidden md:block" />
            </span>
            <span className="flex h-full flex-1 items-end justify-center bg-[#8b5cf6] pb-10 text-white">
              <Swords size={34} strokeWidth={2.2} className="hidden md:block" />
            </span>
          </div>
          <div className="relative md:max-w-[60%]">
            <h2 className="text-[clamp(2.2rem,6.5vw,5.2rem)] font-black leading-[0.9] tracking-[-0.055em]">
              {t('landing.closing.title')}
            </h2>
            <p className="mt-5 max-w-lg text-base font-medium leading-relaxed text-[#07060b]/65 md:text-lg">
              {user ? t('landing.closing.subtitle_user') : t('landing.closing.subtitle_guest')}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                to={primary.to}
                className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-[#07060b] px-6 py-4 text-[15px] font-black text-white transition-transform hover:-translate-y-0.5"
              >
                {primary.label} <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to={secondary.to}
                className="inline-flex items-center justify-center rounded-2xl border-2 border-[#07060b] px-6 py-4 text-[15px] font-black text-[#07060b] transition-colors hover:bg-[#07060b] hover:text-white"
              >
                {secondary.label}
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

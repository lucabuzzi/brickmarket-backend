import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const LIME = '#c6ff3d';

/**
 * Shared stage for the password-recovery flow (forgot → email link → new password):
 * centered card, glowing icon orb and a 3-step progress rail.
 */
export default function RecoveryShell({ icon: Icon, step, tone = LIME, children }) {
  const { t } = useTranslation();
  const steps = ['email', 'link', 'password'];

  return (
    <div className="lx-page min-h-[calc(100vh-4rem)]">
      <div className="lx-bleed lx-grid pointer-events-none absolute inset-y-0 opacity-30" aria-hidden />
      <div className="pointer-events-none absolute left-1/2 top-24 h-[420px] w-[620px] -translate-x-1/2 rounded-full opacity-[0.13] blur-[120px]" style={{ background: tone }} aria-hidden />

      <div className="relative mx-auto flex max-w-xl flex-col items-center px-4 pb-20 pt-24 md:pt-28">
        <Link to="/login" className="mb-8 inline-flex min-h-10 items-center gap-2 self-start text-sm font-semibold text-white/55 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          {t('recover_page.back_login')}
        </Link>

        <ol className="mb-10 flex w-full items-center" aria-label={t('recover_page.kicker')}>
          {steps.map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li key={s} className={`flex items-center ${i < steps.length - 1 ? 'flex-1' : ''}`}>
                <span className="flex flex-col items-center gap-2">
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-black transition ${done || active ? '' : 'border-white/15 text-white/35'}`}
                    style={done ? { background: tone, borderColor: tone, color: '#10140a' } : active ? { borderColor: tone, color: '#fff' } : undefined}
                    aria-current={active ? 'step' : undefined}
                  >
                    {done ? <Check className="h-4 w-4" strokeWidth={3.5} /> : i + 1}
                  </span>
                  <span className={`whitespace-nowrap text-[11px] font-bold uppercase tracking-wider ${active ? 'text-white' : 'text-white/40'}`}>
                    {t(`recover_page.step_${s}`)}
                  </span>
                </span>
                {i < steps.length - 1 && (
                  <span className="mx-2 mb-6 h-0.5 flex-1 rounded-full bg-white/10">
                    <span className="block h-full rounded-full transition-all duration-700" style={{ width: done ? '100%' : '0%', background: tone }} />
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        <motion.div
          initial={{ y: 24 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full"
        >
          <div
            className="lx-arena-ring pointer-events-none absolute -inset-px rounded-[2rem]"
            style={{ background: `conic-gradient(from var(--lx-ring-angle, 0deg), ${tone}, #22d3ee, #8b5cf6, ${tone})`, opacity: 0.3 }}
            aria-hidden
          />
          <div className="relative rounded-[2rem] border border-white/10 bg-[#0d0c12]/95 px-5 pb-7 pt-14 backdrop-blur-xl sm:px-9 sm:pb-9">
            <div className="absolute -top-9 left-1/2 flex h-[72px] w-[72px] -translate-x-1/2 items-center justify-center">
              <span className="absolute inset-0 rounded-full opacity-50 blur-xl" style={{ background: tone }} />
              <span className="lx-float relative flex h-full w-full items-center justify-center rounded-full border border-white/15 bg-[#15131c]">
                <Icon className="h-8 w-8" style={{ color: tone }} strokeWidth={2} />
              </span>
            </div>
            {children}
          </div>
        </motion.div>

        <p className="mt-8 text-center text-sm text-white/45">
          {t('auth.need_help')}{' '}
          <a href="mailto:support@cardbrix.com" className="font-bold text-white/75 underline-offset-4 hover:text-white hover:underline">support@cardbrix.com</a>
        </p>
      </div>
    </div>
  );
}

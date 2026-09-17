import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Eye, EyeOff, Gavel, Lock, Puzzle, ShieldCheck, Tag, User } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { useTranslation } from 'react-i18next';
import Turnstile from '../components/Turnstile';
import GoogleSignInButton from '../components/GoogleSignInButton';
import AppleSignInButton from '../components/AppleSignInButton';
import { MARKET_MODES, useMarketItems } from '../components/market/marketConfig';
import { listingImage } from '../components/landing/landingUtils';

const LIME = '#c6ff3d';
// The social buttons render nothing unless their client id is configured at build time.
const HAS_SOCIAL_LOGIN = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID || import.meta.env.VITE_APPLE_CLIENT_ID);

const inputWrap =
  'group flex h-14 items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 transition focus-within:border-white/45 focus-within:bg-black/60';

/** Three real listing photos fanned out like a hand of cards. */
function CardFan() {
  const reduceMotion = useReducedMotion();
  const { items } = useMarketItems(MARKET_MODES.listings);
  const photos = items.map((i) => listingImage(i, 420)).filter(Boolean).slice(0, 3);
  if (photos.length < 3) return <div className="h-[340px]" aria-hidden />;

  const poses = [
    { rotate: -14, x: -120, y: 26 },
    { rotate: 0, x: 0, y: 0 },
    { rotate: 14, x: 120, y: 26 },
  ];

  return (
    <div className="relative mx-auto h-[340px] w-full max-w-[460px]" aria-hidden>
      <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-[90px]" style={{ background: LIME }} />
      {photos.map((src, i) => (
        <motion.div
          key={src}
          initial={reduceMotion ? false : { y: 40 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.9, delay: 0.15 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="absolute left-1/2 top-2 -ml-[92px]"
          style={{ zIndex: i === 1 ? 2 : 1, translate: `${poses[i].x}px ${poses[i].y}px`, rotate: `${poses[i].rotate}deg` }}
        >
          <div className={`${reduceMotion ? '' : 'lx-float'} h-[260px] w-[184px] overflow-hidden rounded-[22px] border border-white/15 bg-[#15131c] p-1.5 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.8)]`} style={{ animationDelay: `${i * -2.5}s` }}>
            <img src={src} alt="" className="h-full w-full rounded-[16px] object-cover" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export default function Login() {
  const { login, loginWithGoogle, loginWithApple } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!turnstileToken) {
      setError(t('errors.captcha_required'));
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password, turnstileToken);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err?.data?.error || t('errors.invalid_credentials'));
    } finally {
      setSubmitting(false);
    }
  }

  async function onGoogleCredential(credential) {
    setError('');
    setSubmitting(true);
    try {
      await loginWithGoogle(credential);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err?.data?.error || t('errors.oauth_failed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function onAppleSuccess({ id_token, user }) {
    setError('');
    setSubmitting(true);
    try {
      await loginWithApple(id_token, user);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err?.data?.error || t('errors.oauth_failed'));
    } finally {
      setSubmitting(false);
    }
  }

  const pillars = [
    { icon: Tag, label: t('login_page.pill_listings'), color: LIME },
    { icon: Gavel, label: t('login_page.pill_auctions'), color: '#ff5a36' },
    { icon: Puzzle, label: t('login_page.pill_arena'), color: '#8b5cf6' },
  ];

  return (
    <div className="lx-page min-h-[calc(100vh-4rem)]">
      <div className="lx-bleed lx-grid pointer-events-none absolute inset-y-0 opacity-30" aria-hidden />
      <div className="pointer-events-none absolute -right-40 top-40 h-[460px] w-[460px] rounded-full opacity-[0.14] blur-[130px]" style={{ background: '#8b5cf6' }} aria-hidden />

      <div className="relative mx-auto grid max-w-[1320px] grid-cols-1 items-center gap-10 px-4 pb-20 pt-24 md:px-10 md:pt-28 lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,460px)] lg:gap-16 lg:pb-16">
        {/* ── pitch ───────────────────────────────────────── */}
        <motion.div
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="order-2 min-w-0 lg:order-1"
        >
          <p className="text-xs font-black uppercase tracking-[0.24em]" style={{ color: LIME }}>{t('login_page.kicker')}</p>
          <h2 className="mt-3 text-[clamp(2.4rem,5.2vw,4.4rem)] font-black leading-[0.9] tracking-[-0.05em] text-white">
            {t('login_page.title_1')}
            <br />
            <span className="lx-text-arena">{t('login_page.title_2')}</span>
          </h2>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-white/60 md:text-lg">{t('login_page.subtitle')}</p>

          <div className="mt-7 flex flex-wrap gap-2">
            {pillars.map(({ icon: Icon, label, color }) => (
              <span key={label} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm font-bold text-white/80">
                <Icon className="h-4 w-4" style={{ color }} />
                {label}
              </span>
            ))}
          </div>

          <div className="mt-10 hidden lg:block">
            <CardFan />
          </div>
        </motion.div>

        {/* ── form ────────────────────────────────────────── */}
        <motion.div
          initial={{ y: 28 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.6, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className="order-1 min-w-0 lg:order-2"
        >
          <div className="relative">
            <div
              className="lx-arena-ring pointer-events-none absolute -inset-px rounded-[2rem]"
              style={{ background: `conic-gradient(from var(--lx-ring-angle, 0deg), ${LIME}, #22d3ee, #8b5cf6, ${LIME})`, opacity: 0.35 }}
              aria-hidden
            />
            <div className="relative rounded-[2rem] border border-white/10 bg-[#0d0c12]/95 p-5 backdrop-blur-xl sm:p-8">
              <h1 className="text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl">{t('auth.login_title')}</h1>
              <p className="mt-2 text-sm text-white/55">{t('login_page.form_subtitle')}</p>

              <form className="mt-7 flex flex-col gap-4" onSubmit={onSubmit}>
                <div>
                  <label htmlFor="login-email" className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-white/50">
                    {t('auth.username_email')}
                  </label>
                  <div className={inputWrap}>
                    <User className="h-5 w-5 shrink-0 text-white/35 transition group-focus-within:text-white" />
                    <input
                      id="login-email"
                      type="text"
                      name="email"
                      placeholder={t('login_page.email_placeholder')}
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-full min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/30"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label htmlFor="login-password" className="text-[11px] font-black uppercase tracking-[0.18em] text-white/50">
                      {t('auth.password')}
                    </label>
                    <Link to="/forgot-password" className="-my-2 inline-flex min-h-11 items-center text-xs font-bold transition hover:brightness-125" style={{ color: LIME }}>
                      {t('auth.forgot')}
                    </Link>
                  </div>
                  <div className={inputWrap}>
                    <Lock className="h-5 w-5 shrink-0 text-white/35 transition group-focus-within:text-white" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-full min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/30"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? t('login_page.hide_password') : t('login_page.show_password')}
                      aria-pressed={showPassword}
                      className="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/45 transition hover:bg-white/10 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="flex min-h-[65px] justify-center">
                  <Turnstile theme="dark" onVerify={setTurnstileToken} onExpire={() => setTurnstileToken(null)} />
                </div>

                {error && (
                  <p className="rounded-2xl border border-[#ff5a36]/40 bg-[#ff5a36]/10 px-4 py-3 text-sm font-semibold text-[#ff7a5c]" role="alert">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting || !turnstileToken}
                  className="lx-shine relative flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl text-base font-black text-[#10140a] shadow-[0_18px_40px_-14px_rgba(198,255,61,0.6)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                  style={{ background: LIME }}
                >
                  {submitting ? t('auth.logging_in') : t('auth.login_btn')}
                  {!submitting && <ArrowRight className="h-5 w-5" />}
                </button>
              </form>

              {HAS_SOCIAL_LOGIN && (
                <>
                  <div className="my-6 flex items-center gap-4 text-xs font-bold uppercase tracking-[0.2em] text-white/35">
                    <span className="h-px flex-1 bg-white/10" />
                    {t('auth.or_divider')}
                    <span className="h-px flex-1 bg-white/10" />
                  </div>

                  <div className="flex flex-col items-center gap-3">
                    <GoogleSignInButton theme="filled_black" onCredential={onGoogleCredential} onError={() => setError(t('errors.oauth_failed'))} />
                    <AppleSignInButton onSuccess={onAppleSuccess} onError={() => setError(t('errors.oauth_failed'))} />
                  </div>
                </>
              )}

              <Link
                to="/register"
                state={location.state}
                className="group mt-7 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 transition hover:border-white/30"
              >
                <span className="min-w-0">
                  <span className="block text-sm text-white/55">{t('auth.no_account')}</span>
                  <span className="block font-black text-white">{t('login_page.create_account')}</span>
                </span>
                <ArrowRight className="h-5 w-5 shrink-0 transition group-hover:translate-x-1" style={{ color: LIME }} />
              </Link>

              <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-white/35">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                {t('login_page.secure_note')}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

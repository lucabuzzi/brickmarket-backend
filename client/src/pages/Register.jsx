import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, Building2, Check, Eye, EyeOff, FileUp, Gavel, Puzzle, Scale, ShieldCheck, Tag, User,
} from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { useTranslation } from 'react-i18next';
import { trackEvent } from '../analytics';
import Turnstile from '../components/Turnstile';
import GoogleSignInButton from '../components/GoogleSignInButton';
import AppleSignInButton from '../components/AppleSignInButton';

const LIME = '#c6ff3d';
// The social buttons render nothing unless their client id is configured at build time.
const HAS_SOCIAL_LOGIN = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID || import.meta.env.VITE_APPLE_CLIENT_ID);

const inputClass =
  'h-13 w-full min-w-0 rounded-2xl border border-white/10 bg-black/40 px-4 text-base text-white outline-none transition placeholder:text-white/30 focus:border-white/45 focus:bg-black/60';

function Field({ label, hint, children }) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-white/50">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-white/40">{hint}</span>}
    </label>
  );
}

function Section({ step, title, children }) {
  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.025] p-5 sm:p-6">
      <h3 className="mb-5 flex items-center gap-3 text-lg font-black text-white">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-sm font-black text-[#10140a]" style={{ background: LIME }}>
          {step}
        </span>
        {title}
      </h3>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function PasswordInput({ value, onChange, autoComplete }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        required
        minLength={6}
        autoComplete={autoComplete}
        className={`${inputClass} pr-12`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t('login_page.hide_password') : t('login_page.show_password')}
        aria-pressed={visible}
        className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-white/45 transition hover:bg-white/10 hover:text-white"
      >
        {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
}

/** 0–3 score: length plus character variety. Guidance only — the server enforces its own rules. */
function passwordScore(pw) {
  if (!pw) return 0;
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(pw)).length;
  if (pw.length >= 12 && variety >= 3) return 3;
  if (pw.length >= 8 && variety >= 2) return 2;
  return 1;
}

function FilePicker({ label, file, onChange }) {
  const { t } = useTranslation();
  return (
    <label className={`flex min-h-[72px] cursor-pointer items-center gap-4 rounded-2xl border border-dashed p-4 transition ${file ? 'bg-[#c6ff3d]/[0.06]' : 'border-white/20 hover:border-white/40'}`} style={file ? { borderColor: LIME } : undefined}>
      <input type="file" accept="image/*,application/pdf" onChange={(e) => onChange(e.target.files[0])} className="sr-only" />
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
        {file ? <Check className="h-5 w-5" style={{ color: LIME }} strokeWidth={3} /> : <FileUp className="h-5 w-5 text-white/60" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-white">{label}</span>
        <span className="block truncate text-xs text-white/45">{file ? file.name : t('register_page.file_hint')}</span>
      </span>
      <span className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-xs font-bold text-white/70">
        {file ? t('register_page.file_change') : t('register_page.file_choose')}
      </span>
    </label>
  );
}

function Consent({ checked, onChange, children }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${checked ? 'bg-[#c6ff3d]/[0.05]' : 'border-white/10 hover:border-white/25'}`} style={checked ? { borderColor: `${LIME}88` } : undefined}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${checked ? '' : 'border-white/30'}`}
        style={checked ? { borderColor: LIME, background: LIME } : undefined}
      >
        {checked && <Check className="h-3.5 w-3.5 text-[#10140a]" strokeWidth={4} />}
      </span>
      <span className="text-sm leading-snug text-white/80">{children}</span>
    </label>
  );
}

export default function Register() {
  const { register, loginWithGoogle, loginWithApple } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const registrationStartedRef = useRef(false);
  const [turnstileToken, setTurnstileToken] = useState(null);

  const handleFirstFieldFocus = () => {
    if (registrationStartedRef.current) return;
    registrationStartedRef.current = true;
    trackEvent('registration_started');
  };

  const [tab, setTab] = useState('private'); // 'private' o 'professional'

  // Generic
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');

  // Private Only
  const [privateFullName, setPrivateFullName] = useState('');

  // Merchant Only (Specifico per il profilo professionale)
  const [companyName, setCompanyName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  // Indirizzo (Per entrambi i profili)
  const [street, setStreet] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [phone, setPhone] = useState('');

  // Merchant Only (Verifiche documenti)
  const [idScan, setIdScan] = useState(null);
  const [businessLicense, setBusinessLicense] = useState(null);

  // Checkboxes (Obbligatorie per entrambi)
  const [acceptTos, setAcceptTos] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptRevocation, setAcceptRevocation] = useState(false);

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onGoogleCredential(credential) {
    setError('');
    setSubmitting(true);
    try {
      await loginWithGoogle(credential);
      navigate('/', { replace: true });
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
      navigate('/', { replace: true });
    } catch (err) {
      setError(err?.data?.error || t('errors.oauth_failed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');

    // Controllo Password
    if (password !== repeatPassword) {
      return setError(t('errors.passwords_dont_match'));
    }

    // Validazione consensi legali obbligatoria per tutti
    if (!acceptTos || !acceptPrivacy || !acceptRevocation) {
      return setError(t('errors.accept_legal'));
    }

    // Validazione specifica documenti per Merchant
    if (tab === 'professional') {
      if (!idScan || !businessLicense) {
        return setError(t('errors.upload_required'));
      }
    }

    if (!turnstileToken) {
      return setError(t('errors.captcha_required'));
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('username', username.trim());
      formData.append('email', email.trim());
      formData.append('password', password);
      formData.append('turnstileToken', turnstileToken);

      // Dati indirizzo inclusi per entrambi i tipi di account
      formData.append('street', street.trim());
      formData.append('houseNumber', houseNumber.trim());
      formData.append('zipCode', zipCode.trim());
      formData.append('city', city.trim());
      formData.append('country', country.trim());
      formData.append('phone', phone.trim());

      if (tab === 'private') {
        formData.append('role', 'buyer');
        formData.append('sellerType', 'private');
        if (privateFullName.trim()) formData.append('fullName', privateFullName.trim());
      } else {
        formData.append('role', 'seller');
        formData.append('sellerType', 'professional');
        formData.append('companyName', companyName.trim());
        formData.append('fullName', `${firstName.trim()} ${lastName.trim()}`);
        formData.append('id_scan', idScan);
        formData.append('business_license', businessLicense);
      }

      await register(formData);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || t('errors.registration_failed'));
    } finally {
      setSubmitting(false);
    }
  }

  const isPro = tab === 'professional';
  const score = passwordScore(password);
  const strength = [null, { key: 'weak', color: '#ff5a36' }, { key: 'medium', color: '#facc15' }, { key: 'strong', color: LIME }][score];
  const repeatState = repeatPassword ? (repeatPassword === password ? 'match' : 'mismatch') : null;

  let step = 0;
  const nextStep = () => { step += 1; return step; };

  const accountTypes = [
    { id: 'private', icon: User, title: t('auth.private_account'), desc: t('register_page.type_private_desc') },
    { id: 'professional', icon: Building2, title: t('auth.professional_account'), desc: t('register_page.type_pro_desc') },
  ];

  const perks = [
    { icon: Tag, text: t('register_page.perk_listings'), color: LIME },
    { icon: Gavel, text: t('register_page.perk_auctions'), color: '#ff5a36' },
    { icon: Puzzle, text: t('register_page.perk_arena'), color: '#8b5cf6' },
  ];

  return (
    <div className="lx-page">
      <div className="lx-bleed lx-grid pointer-events-none absolute inset-y-0 opacity-30" aria-hidden />
      <div className="pointer-events-none absolute -left-40 top-20 h-[460px] w-[460px] rounded-full opacity-[0.13] blur-[130px]" style={{ background: LIME }} aria-hidden />
      <div className="pointer-events-none absolute -right-40 top-[40%] h-[460px] w-[460px] rounded-full opacity-[0.12] blur-[130px]" style={{ background: '#8b5cf6' }} aria-hidden />

      <div className="relative mx-auto grid max-w-[1320px] grid-cols-1 items-start gap-10 px-4 pb-24 pt-24 md:px-10 md:pt-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,600px)] lg:gap-16">
        {/* ── pitch ───────────────────────────────────────── */}
        <motion.aside
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="min-w-0 lg:sticky lg:top-28"
        >
          <p className="text-xs font-black uppercase tracking-[0.24em]" style={{ color: LIME }}>{t('register_page.kicker')}</p>
          <h2 className="mt-3 text-[clamp(2.4rem,5.2vw,4.6rem)] font-black leading-[0.9] tracking-[-0.05em] text-white">
            {t('register_page.title_1')}
            <br />
            <span className="lx-text-arena">{t('register_page.title_2')}</span>
          </h2>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-white/60 md:text-lg">{t('register_page.subtitle')}</p>

          <ul className="mt-8 hidden max-w-lg flex-col gap-3 sm:flex">
            {perks.map(({ icon: Icon, text, color }) => (
              <li key={text} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: `${color}1f` }}>
                  <Icon className="h-5 w-5" style={{ color }} />
                </span>
                <span className="text-[15px] font-bold text-white/85">{text}</span>
              </li>
            ))}
          </ul>

          <p className="mt-8 text-sm text-white/55">
            {t('auth.have_account')}{' '}
            <Link to="/login" className="inline-flex min-h-10 items-center font-black transition hover:brightness-125" style={{ color: LIME }}>
              {t('nav.login')} →
            </Link>
          </p>
        </motion.aside>

        {/* ── form ────────────────────────────────────────── */}
        <motion.div
          initial={{ y: 28 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.6, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className="min-w-0"
        >
          <div className="relative">
            <div
              className="lx-arena-ring pointer-events-none absolute -inset-px rounded-[2rem]"
              style={{ background: `conic-gradient(from var(--lx-ring-angle, 0deg), ${LIME}, #22d3ee, #8b5cf6, ${LIME})`, opacity: 0.3 }}
              aria-hidden
            />
            <div className="relative rounded-[2rem] border border-white/10 bg-[#0d0c12]/95 p-4 backdrop-blur-xl sm:p-7">
              <h1 className="px-1 text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl">{t('auth.register_title')}</h1>
              <p className="mt-2 px-1 text-sm text-white/55">{t('register_page.form_subtitle')}</p>

              {/* account type */}
              <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label={t('register_page.type_label')}>
                {accountTypes.map(({ id, icon: Icon, title, desc }) => {
                  const active = tab === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setTab(id)}
                      className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${active ? 'bg-[#c6ff3d]/[0.07]' : 'border-white/10 bg-white/[0.02] hover:border-white/25'}`}
                      style={active ? { borderColor: LIME } : undefined}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={active ? { background: LIME } : { background: 'rgba(255,255,255,0.06)' }}>
                        <Icon className={`h-5 w-5 ${active ? 'text-[#10140a]' : 'text-white/60'}`} />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-black text-white">{title}</span>
                        <span className="mt-0.5 block text-xs leading-snug text-white/50">{desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {HAS_SOCIAL_LOGIN && (
                <>
                  <div className="mt-6 flex flex-col items-center gap-3">
                    <GoogleSignInButton theme="filled_black" onCredential={onGoogleCredential} onError={() => setError(t('errors.oauth_failed'))} />
                    <AppleSignInButton onSuccess={onAppleSuccess} onError={() => setError(t('errors.oauth_failed'))} />
                  </div>
                  <div className="my-6 flex items-center gap-4 text-xs font-bold uppercase tracking-[0.2em] text-white/35">
                    <span className="h-px flex-1 bg-white/10" />
                    {t('auth.or_divider')}
                    <span className="h-px flex-1 bg-white/10" />
                  </div>
                </>
              )}

              <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
                {isPro && (
                  <Section step={nextStep()} title={t('auth.company_info')}>
                    <Field label={t('auth.company_name')}>
                      <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required autoComplete="organization" className={inputClass} />
                    </Field>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label={t('auth.first_name')}>
                        <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoComplete="given-name" className={inputClass} />
                      </Field>
                      <Field label={t('auth.last_name')}>
                        <input value={lastName} onChange={(e) => setLastName(e.target.value)} required autoComplete="family-name" className={inputClass} />
                      </Field>
                    </div>
                  </Section>
                )}

                <Section step={nextStep()} title={t('auth.login_credentials')}>
                  <Field label="Email">
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onFocus={handleFirstFieldFocus} required autoComplete="email" inputMode="email" placeholder="nome@email.it" className={inputClass} />
                  </Field>
                  <Field label="Username" hint={t('register_page.username_hint')}>
                    <input value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" autoCapitalize="none" spellCheck={false} minLength={3} className={inputClass} />
                  </Field>

                  {!isPro && (
                    <Field label={t('auth.full_name_optional')}>
                      <input value={privateFullName} onChange={(e) => setPrivateFullName(e.target.value)} autoComplete="name" className={inputClass} />
                    </Field>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="min-w-0">
                      <Field label={t('auth.password')}>
                        <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                      </Field>
                      {strength && (
                        <div className="mt-2" aria-live="polite">
                          <div className="flex gap-1">
                            {[1, 2, 3].map((n) => (
                              <span key={n} className="h-1 flex-1 rounded-full transition-colors" style={{ background: n <= score ? strength.color : 'rgba(255,255,255,0.1)' }} />
                            ))}
                          </div>
                          <p className="mt-1 text-xs font-bold" style={{ color: strength.color }}>{t(`register_page.strength_${strength.key}`)}</p>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <Field label={t('auth.password_repeat')}>
                        <PasswordInput value={repeatPassword} onChange={(e) => setRepeatPassword(e.target.value)} autoComplete="new-password" />
                      </Field>
                      {repeatState && (
                        <p className="mt-2 flex items-center gap-1.5 text-xs font-bold" style={{ color: repeatState === 'match' ? LIME : '#ff7a5c' }} aria-live="polite">
                          {repeatState === 'match' && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                          {t(`register_page.passwords_${repeatState}`)}
                        </p>
                      )}
                    </div>
                  </div>
                </Section>

                <Section step={nextStep()} title={t('auth.address')}>
                  <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-3 sm:grid-cols-[minmax(0,3fr)_minmax(0,1fr)] sm:gap-4">
                    <Field label={t('auth.street')}>
                      <input value={street} onChange={(e) => setStreet(e.target.value)} required autoComplete="address-line1" className={inputClass} />
                    </Field>
                    <Field label={t('auth.house_number')}>
                      <input value={houseNumber} onChange={(e) => setHouseNumber(e.target.value)} required className={inputClass} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-4">
                    <Field label={t('auth.zip')}>
                      <input value={zipCode} onChange={(e) => setZipCode(e.target.value)} required autoComplete="postal-code" className={inputClass} />
                    </Field>
                    <Field label={t('auth.city')}>
                      <input value={city} onChange={(e) => setCity(e.target.value)} required autoComplete="address-level2" className={inputClass} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label={t('auth.country')}>
                      <input value={country} onChange={(e) => setCountry(e.target.value)} required autoComplete="country-name" className={inputClass} />
                    </Field>
                    <Field label={t('auth.phone')}>
                      <input value={phone} onChange={(e) => setPhone(e.target.value)} required type="tel" autoComplete="tel" inputMode="tel" className={inputClass} />
                    </Field>
                  </div>
                </Section>

                {isPro && (
                  <Section step={nextStep()} title={t('auth.verifications')}>
                    <FilePicker label={t('auth.id_scan')} file={idScan} onChange={setIdScan} />
                    <FilePicker label={t('auth.business_license')} file={businessLicense} onChange={setBusinessLicense} />
                    <p className="flex items-start gap-2 text-xs leading-relaxed text-white/45">
                      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {t('auth.gdpr_note')}
                    </p>
                  </Section>
                )}

                <Section step={nextStep()} title={t('register_page.consents_title')}>
                  <Consent checked={acceptTos} onChange={setAcceptTos}>{t('auth.accept_tos')}</Consent>
                  <Consent checked={acceptPrivacy} onChange={setAcceptPrivacy}>{t('auth.accept_privacy')}</Consent>
                  <Consent checked={acceptRevocation} onChange={setAcceptRevocation}>{t('auth.accept_revocation')}</Consent>
                  <Link to="/norme-legali" target="_blank" rel="noopener" className="inline-flex min-h-10 w-fit items-center gap-2 text-sm font-bold text-white/60 transition hover:text-white">
                    <Scale className="h-4 w-4" />
                    {t('register_page.legal_link')}
                  </Link>
                </Section>

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
                  {submitting ? t('auth.registering') : t('auth.register_btn')}
                  {!submitting && <ArrowRight className="h-5 w-5" />}
                </button>

                <p className="text-center text-sm text-white/50 lg:hidden">
                  {t('auth.have_account')}{' '}
                  <Link to="/login" className="inline-flex min-h-10 items-center font-black" style={{ color: LIME }}>{t('nav.login')}</Link>
                </p>
              </form>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useTranslation } from 'react-i18next';
import { trackEvent } from '../analytics';
import Turnstile from '../components/Turnstile';
import GoogleSignInButton from '../components/GoogleSignInButton';
import AppleSignInButton from '../components/AppleSignInButton';
import { StitchCard } from '../components/StitchComponents';

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

  return (
    <div className="page auth-page pt-24 px-4">
      <h1 className="text-center">{t('auth.register_title')}</h1>

      <div className="max-w-xl mx-auto mt-6 mb-6 flex flex-col items-center gap-3">
        <GoogleSignInButton onCredential={onGoogleCredential} onError={() => setError(t('errors.oauth_failed'))} />
        <AppleSignInButton onSuccess={onAppleSuccess} onError={() => setError(t('errors.oauth_failed'))} />
      </div>
      <div className="oauth-divider max-w-xl mx-auto mb-6">{t('auth.or_divider')}</div>

      {/* Selezione Tipo Account: segmented control in stile bento-glass */}
      <div className="max-w-xl mx-auto mb-8 flex justify-center">
        <div className="inline-flex p-1 rounded-2xl bg-stone-900/40 border border-white/5 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setTab('private')}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition-colors ${
              tab === 'private' ? 'bg-gold-500 text-white shadow-[0_0_20px_rgba(212,175,55,0.3)]' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            {t('auth.private_account')}
          </button>
          <button
            type="button"
            onClick={() => setTab('professional')}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition-colors ${
              tab === 'professional' ? 'bg-gold-500 text-white shadow-[0_0_20px_rgba(212,175,55,0.3)]' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            {t('auth.professional_account')}
          </button>
        </div>
      </div>

      <form className="form max-w-xl mx-auto" onSubmit={onSubmit}>

        {/* 1. Info Aziendali (Solo Merchant) */}
        {tab === 'professional' && (
          <StitchCard glowColor="blue" className="!p-5 sm:!p-6">
            <h3 className="mt-0">{t('auth.company_info')}</h3>
            <div className="flex flex-col gap-3">
              <label>
                {t('auth.company_name')}
                <input value={companyName} onChange={e => setCompanyName(e.target.value)} required />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label>{t('auth.first_name')} <input value={firstName} onChange={e => setFirstName(e.target.value)} required /></label>
                <label>{t('auth.last_name')} <input value={lastName} onChange={e => setLastName(e.target.value)} required /></label>
              </div>
            </div>
          </StitchCard>
        )}

        {/* 2. Credenziali di accesso (Ora prima dell'indirizzo)  */}
        <StitchCard glowColor="blue" className="!p-5 sm:!p-6">
          <h3 className="mt-0">{t('auth.login_credentials')}</h3>
          <div className="flex flex-col gap-3">
            <label>Email <input type="email" value={email} onChange={e => setEmail(e.target.value)} onFocus={handleFirstFieldFocus} required autoComplete="email" /></label>
            <label>Username <input value={username} onChange={e => setUsername(e.target.value)} required autoComplete="username" minLength={3} /></label>

            {tab === 'private' && (
              <label>{t('auth.full_name_optional')} <input value={privateFullName} onChange={e => setPrivateFullName(e.target.value)} /></label>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label>{t('auth.password')} <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} /></label>
              <label>{t('auth.password_repeat')} <input type="password" value={repeatPassword} onChange={e => setRepeatPassword(e.target.value)} required minLength={6} /></label>
            </div>
          </div>
        </StitchCard>

        {/* 3. Sezione Indirizzo (Sotto le credenziali)  */}
        <StitchCard glowColor="blue" className="!p-5 sm:!p-6">
          <h3 className="mt-0">{t('auth.address')}</h3>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-[3fr_1fr] gap-3">
              <label>{t('auth.street')} <input value={street} onChange={e => setStreet(e.target.value)} required /></label>
              <label>{t('auth.house_number')} <input value={houseNumber} onChange={e => setHouseNumber(e.target.value)} required /></label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-3">
              <label>{t('auth.zip')} <input value={zipCode} onChange={e => setZipCode(e.target.value)} required /></label>
              <label>{t('auth.city')} <input value={city} onChange={e => setCity(e.target.value)} required /></label>
            </div>
            <label>
              {t('auth.country')} <input value={country} onChange={e => setCountry(e.target.value)} required />
            </label>
            <label>
              {t('auth.phone')} <input value={phone} onChange={e => setPhone(e.target.value)} required />
            </label>
          </div>
        </StitchCard>

        {/* 4. Verifiche documenti (Solo Merchant) */}
        {tab === 'professional' && (
          <StitchCard glowColor="amber" className="!p-5 sm:!p-6">
            <h3 className="mt-0">{t('auth.verifications')}</h3>
            <div className="flex flex-col gap-3">
              <label>
                {t('auth.id_scan')}
                <input type="file" accept="image/*,application/pdf" onChange={e => setIdScan(e.target.files[0])} required />
              </label>
              <label>
                {t('auth.business_license')}
                <input type="file" accept="image/*,application/pdf" onChange={e => setBusinessLicense(e.target.files[0])} required />
              </label>
            </div>
            <p className="muted text-xs mt-3 mb-0">{t('auth.gdpr_note')}</p>
          </StitchCard>
        )}

        {/* 5. Consensi Legali (Obbligatori per tutti)  */}
        <StitchCard glowColor="blue" className="!p-5 sm:!p-6">
          <div className="flex flex-col gap-3">
            <label className="!flex-row items-center gap-2 font-normal text-sm">
              <input type="checkbox" style={{ width: 'auto' }} checked={acceptTos} onChange={e => setAcceptTos(e.target.checked)} />
              {t('auth.accept_tos')}
            </label>
            <label className="!flex-row items-center gap-2 font-normal text-sm">
              <input type="checkbox" style={{ width: 'auto' }} checked={acceptPrivacy} onChange={e => setAcceptPrivacy(e.target.checked)} />
              {t('auth.accept_privacy')}
            </label>
            <label className="!flex-row items-center gap-2 font-normal text-sm">
              <input type="checkbox" style={{ width: 'auto' }} checked={acceptRevocation} onChange={e => setAcceptRevocation(e.target.checked)} />
              {t('auth.accept_revocation')}
            </label>
          </div>
        </StitchCard>

        <div className="flex justify-center">
          <Turnstile onVerify={setTurnstileToken} onExpire={() => setTurnstileToken(null)} />
        </div>

        {error && <p className="error-banner">{error}</p>}

        <button
          type="submit"
          className="btn btn--primary w-full py-4 text-lg"
          disabled={submitting || !turnstileToken}
        >
          {submitting ? t('auth.registering') : t('auth.register_btn')}
        </button>
      </form>

      <p className="muted text-center mt-4">
        {t('auth.have_account')} <Link to="/login">{t('nav.login')}</Link>
      </p>
    </div>
  );
}
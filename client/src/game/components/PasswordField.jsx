import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** Game-styled password input with the same show/hide eye as the site's login page. */
export default function PasswordField({ value, onChange, autoComplete, minLength, required = true }) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        className="cbg-input"
        style={{ paddingRight: '3.25rem' }}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        autoCapitalize="none"
        spellCheck={false}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? t('login_page.hide_password') : t('login_page.show_password')}
        aria-pressed={show}
        className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-white/55 transition hover:text-white"
      >
        {show ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
      </button>
    </div>
  );
}

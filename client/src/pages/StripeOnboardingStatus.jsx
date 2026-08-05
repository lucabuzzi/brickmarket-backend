import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { StitchCard } from '../components/StitchComponents';

/** Landing page Stripe Connect redirects back to after onboarding (see accountLinks.create
 *  in src/routes/payments.js) — shared by marketplace sellers and wallet credit conversion,
 *  since both flows reuse the same Connect account. */
export default function StripeOnboardingStatus({ outcome }) {
  const { t } = useTranslation();
  const isComplete = outcome === 'complete';

  useEffect(() => {
    document.title = isComplete ? t('stripeOnboarding.complete_title') : t('stripeOnboarding.retry_title');
  }, [isComplete, t]);

  return (
    <div className="max-w-lg mx-auto px-4 py-16 animate-fadeIn text-center">
      <StitchCard glowColor={isComplete ? 'blue' : 'amber'} className="p-8">
        {isComplete ? (
          <CheckCircle2 className="h-14 w-14 text-emerald-400 mx-auto mb-5" />
        ) : (
          <AlertTriangle className="h-14 w-14 text-amber-400 mx-auto mb-5" />
        )}
        <h1 className="text-xl font-black text-white uppercase mb-2">
          {isComplete ? t('stripeOnboarding.complete_title') : t('stripeOnboarding.retry_title')}
        </h1>
        <p className="text-stone-400 text-sm mb-8">
          {isComplete ? t('stripeOnboarding.complete_desc') : t('stripeOnboarding.retry_desc')}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/crediti/converti"
            className="px-6 py-2.5 bg-gold-500 hover:bg-gold-400 text-white rounded-xl font-bold uppercase text-xs tracking-wider transition-all active-shrink"
          >
            {t('stripeOnboarding.back_to_convert')}
          </Link>
          <Link
            to="/account"
            className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold uppercase text-xs tracking-wider transition-all"
          >
            {t('stripeOnboarding.back_to_account')}
          </Link>
        </div>
      </StitchCard>
    </div>
  );
}

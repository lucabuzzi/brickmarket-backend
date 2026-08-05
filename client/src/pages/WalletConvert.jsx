import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Landmark, CheckCircle, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { apiFetch } from '../api';

export default function WalletConvert() {
  const { t } = useTranslation();
  const { user, wallet, refreshWallet } = useAuth();

  const [checkingStatus, setCheckingStatus] = useState(true);
  const [payoutsEnabled, setPayoutsEnabled] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('idle'); // idle | processing | success | error
  const [errorMessage, setErrorMessage] = useState('');
  const [newBalance, setNewBalance] = useState(null);

  useEffect(() => {
    document.title = t('wallet.convert_page_title');
  }, [t]);

  useEffect(() => {
    if (!user) {
      setCheckingStatus(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch('/api/wallet/payout-status');
        if (!cancelled) setPayoutsEnabled(!!data?.payoutsEnabled);
      } catch (err) {
        console.error('Error fetching payout status:', err);
      } finally {
        if (!cancelled) setCheckingStatus(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const balance = wallet?.balanceCredits || 0;
  const numericAmount = parseFloat(amount) || 0;
  const isValidAmount = numericAmount > 0 && numericAmount <= balance;

  const handleStartOnboarding = async () => {
    setOnboarding(true);
    setErrorMessage('');
    try {
      const data = await apiFetch('/api/payments/stripe/onboard-seller', {
        method: 'POST',
        body: { email: user.email },
      });
      window.location.href = data.onboardingUrl;
    } catch (err) {
      setOnboarding(false);
      setErrorMessage(err?.data?.error || t('wallet.onboarding_start_failed'));
    }
  };

  const handleConvert = async () => {
    if (!isValidAmount) return;
    setStatus('processing');
    setErrorMessage('');
    try {
      const data = await apiFetch('/api/wallet/convert', {
        method: 'POST',
        body: { credits: numericAmount },
      });
      await refreshWallet();
      setNewBalance(data?.newBalanceCredits ?? null);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      const code = err?.data?.error;
      if (code === 'stripe_onboarding_required' || code === 'stripe_onboarding_incomplete') {
        setPayoutsEnabled(false);
        setErrorMessage(t('wallet.onboarding_required_notice'));
      } else {
        setErrorMessage(code || t('wallet.convert_failed'));
      }
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-12 animate-fadeIn">
      <Link to="/crediti" className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-stone-500 hover:text-gold-400 transition-colors mb-8 w-fit">
        <ArrowLeft className="h-3.5 w-3.5" /> {t('wallet.hero_title')}
      </Link>

      <div className="bento-card p-8 border border-white/5 bg-[#14120b]/30 rounded-3xl">
        {status === 'success' ? (
          <div className="text-center py-6">
            <CheckCircle className="h-14 w-14 text-emerald-400 mx-auto mb-5" />
            <h1 className="text-xl font-black text-white uppercase mb-2">{t('wallet.convert_success_title')}</h1>
            <p className="text-stone-400 text-sm mb-6">
              {t('wallet.convert_success_desc', { amount: numericAmount.toFixed(2) })}
            </p>
            {newBalance !== null && newBalance !== undefined && (
              <div className="inline-block bg-black/30 border border-white/10 rounded-xl px-6 py-3 mb-8">
                <span className="text-[10px] uppercase tracking-widest text-stone-500 block mb-1">{t('wallet.new_balance')}</span>
                <span className="text-2xl font-black text-gold-400 font-mono">{parseFloat(newBalance).toFixed(0)} CR</span>
              </div>
            )}
            <Link
              to="/crediti"
              className="inline-block px-6 py-2.5 bg-gold-500 hover:bg-gold-400 text-white rounded-xl font-bold uppercase text-xs tracking-wider transition-all active-shrink"
            >
              {t('wallet.back_to_wallet')}
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-11 w-11 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center text-gold-400">
                <Landmark className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-black text-white uppercase tracking-tight">{t('wallet.convert_credits_cta')}</h1>
                <p className="text-[11px] text-stone-500">{t('wallet.exchange_rate_fixed')}</p>
              </div>
            </div>

            {checkingStatus ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-stone-500" />
              </div>
            ) : !payoutsEnabled ? (
              <div>
                <div className="flex items-start gap-3 p-4 bg-black/30 border border-white/10 rounded-xl mb-6">
                  <ShieldCheck className="h-5 w-5 text-gold-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-stone-400 leading-relaxed">{t('wallet.onboarding_explainer')}</p>
                </div>

                {errorMessage && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs text-center mb-4">
                    {errorMessage}
                  </div>
                )}

                <button
                  onClick={handleStartOnboarding}
                  disabled={onboarding}
                  className="w-full py-3.5 bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-white rounded-xl font-bold uppercase text-sm tracking-wider transition-all active-shrink flex items-center justify-center gap-2"
                >
                  {onboarding ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> {t('wallet.processing')}
                    </>
                  ) : (
                    t('wallet.start_onboarding_cta')
                  )}
                </button>
              </div>
            ) : (
              <>
                <div className="bg-black/30 border border-white/10 rounded-xl p-4 mb-4 flex items-center justify-between">
                  <span className="text-xs text-stone-400 uppercase font-bold tracking-wider">{t('wallet.your_balance')}</span>
                  <span className="text-xl font-black text-gold-400 font-mono">{balance.toFixed(0)} CR</span>
                </div>

                <label className="block text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-2">
                  {t('wallet.convert_amount_label')}
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  max={balance}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={t('wallet.convert_amount_placeholder')}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-gold-500 mb-2"
                />
                {numericAmount > balance && (
                  <p className="text-[11px] text-rose-400 mb-4">{t('wallet.convert_insufficient_balance')}</p>
                )}

                <div className="bg-black/30 border border-white/10 rounded-xl p-4 mb-6 flex items-center justify-between">
                  <span className="text-xs text-stone-400 uppercase font-bold tracking-wider">{t('wallet.you_will_receive_eur')}</span>
                  <span className="text-2xl font-black text-gold-400 font-mono">€{numericAmount.toFixed(2)}</span>
                </div>

                {status === 'error' && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs text-center mb-4">
                    {errorMessage}
                  </div>
                )}

                <button
                  onClick={handleConvert}
                  disabled={status === 'processing' || !isValidAmount}
                  className="w-full py-3.5 bg-gold-500 hover:bg-gold-400 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold uppercase text-sm tracking-wider transition-all active-shrink flex items-center justify-center gap-2"
                >
                  {status === 'processing' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> {t('wallet.processing')}
                    </>
                  ) : (
                    t('wallet.confirm_convert', { amount: numericAmount.toFixed(2) })
                  )}
                </button>

                <p className="text-[10px] text-stone-500 text-center mt-4 leading-relaxed">
                  {t('wallet.convert_payout_notice')}
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

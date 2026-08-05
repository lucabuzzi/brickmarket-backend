import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { ArrowLeft, Coins, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { apiFetch } from '../api';

const PRESET_AMOUNTS = [10, 25, 50, 100];

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

const cardElementOptions = {
  style: {
    base: {
      color: '#f5f5f4',
      fontSize: '16px',
      '::placeholder': { color: '#78716c' },
    },
    invalid: { color: '#fb7185' },
  },
};

function CheckoutForm() {
  const { t } = useTranslation();
  const { user, refreshWallet } = useAuth();
  const navigate = useNavigate();
  const stripe = useStripe();
  const elements = useElements();
  const [searchParams] = useSearchParams();

  const initialAmount = parseFloat(searchParams.get('amount')) || 25;
  const [amount, setAmount] = useState(PRESET_AMOUNTS.includes(initialAmount) ? initialAmount : 25);
  const [customAmount, setCustomAmount] = useState('');
  const [status, setStatus] = useState('idle'); // idle | processing | success | error
  const [errorMessage, setErrorMessage] = useState('');
  const [newBalance, setNewBalance] = useState(null);

  useEffect(() => {
    document.title = t('wallet.purchase_page_title');
  }, [t]);

  const effectiveAmount = customAmount ? parseFloat(customAmount) : amount;
  const creditsToReceive = Math.round(effectiveAmount || 0);

  const handleSelectPreset = (value) => {
    setAmount(value);
    setCustomAmount('');
  };

  const handleConfirmPurchase = async () => {
    if (!user || !effectiveAmount || effectiveAmount <= 0 || !stripe || !elements) return;

    setStatus('processing');
    setErrorMessage('');

    try {
      const { clientSecret } = await apiFetch('/api/wallet/create-topup-intent', {
        method: 'POST',
        body: { amountEuros: effectiveAmount },
      });

      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: elements.getElement(CardElement) },
      });

      if (result.error) {
        setStatus('error');
        setErrorMessage(result.error.message || t('wallet.payment_failed'));
        return;
      }

      const confirmData = await apiFetch('/api/wallet/confirm-topup', {
        method: 'POST',
        body: { paymentIntentId: result.paymentIntent.id },
      });

      await refreshWallet();
      setNewBalance(confirmData?.balanceCredits ?? null);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message || t('wallet.payment_comm_error'));
    }
  };

  return (
    <div className="bento-card p-8 border border-white/5 bg-[#14120b]/30 rounded-3xl">
      {status === 'success' ? (
        <div className="text-center py-6">
          <CheckCircle className="h-14 w-14 text-emerald-400 mx-auto mb-5" />
          <h1 className="text-xl font-black text-white uppercase mb-2">{t('wallet.purchase_success_title')}</h1>
          <p className="text-stone-400 text-sm mb-6">
            {t('wallet.purchase_received', { credits: creditsToReceive })}
          </p>
          {newBalance !== null && newBalance !== undefined && (
            <div className="inline-block bg-black/30 border border-white/10 rounded-xl px-6 py-3 mb-8">
              <span className="text-[10px] uppercase tracking-widest text-stone-500 block mb-1">{t('wallet.new_balance')}</span>
              <span className="text-2xl font-black text-gold-400 font-mono">{parseFloat(newBalance).toFixed(0)} CR</span>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate('/skill-zone')}
              className="px-6 py-2.5 bg-gold-500 hover:bg-gold-400 text-white rounded-xl font-bold uppercase text-xs tracking-wider transition-all active-shrink"
            >
              {t('wallet.goto_skillzone')}
            </button>
            <Link
              to="/crediti"
              className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold uppercase text-xs tracking-wider transition-all text-center"
            >
              {t('wallet.back_to_wallet')}
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-6">
            <div className="h-11 w-11 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center text-gold-400">
              <Coins className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white uppercase tracking-tight">{t('wallet.buy_credits_cta')}</h1>
              <p className="text-[11px] text-stone-500">{t('wallet.exchange_rate_fixed')}</p>
            </div>
          </div>

          <label className="block text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-3">
            {t('wallet.select_amount')}
          </label>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {PRESET_AMOUNTS.map((value) => (
              <button
                key={value}
                onClick={() => handleSelectPreset(value)}
                className={`py-3 rounded-xl font-bold text-sm transition-all border ${
                  !customAmount && amount === value
                    ? 'bg-gold-500 border-gold-500 text-white'
                    : 'bg-black/30 border-white/10 text-stone-300 hover:border-gold-500/50'
                }`}
              >
                €{value}
              </button>
            ))}
          </div>

          <label className="block text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-2">
            {t('wallet.custom_amount_label')}
          </label>
          <input
            type="number"
            min="1"
            step="1"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            placeholder={t('wallet.custom_amount_placeholder')}
            className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-gold-500 mb-6"
          />

          <div className="bg-black/30 border border-white/10 rounded-xl p-4 mb-6 flex items-center justify-between">
            <span className="text-xs text-stone-400 uppercase font-bold tracking-wider">{t('wallet.you_will_receive')}</span>
            <span className="text-2xl font-black text-gold-400 font-mono">{creditsToReceive} CR</span>
          </div>

          <label className="block text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-2">
            {t('wallet.card_details_label')}
          </label>
          <div className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3.5 mb-6 focus-within:border-gold-500">
            <CardElement options={cardElementOptions} />
          </div>

          {status === 'error' && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs text-center mb-4">
              {errorMessage}
            </div>
          )}

          <button
            onClick={handleConfirmPurchase}
            disabled={status === 'processing' || !effectiveAmount || effectiveAmount <= 0 || !stripe}
            className="w-full py-3.5 bg-gold-500 hover:bg-gold-400 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold uppercase text-sm tracking-wider transition-all active-shrink flex items-center justify-center gap-2"
          >
            {status === 'processing' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> {t('wallet.processing')}
              </>
            ) : (
              t('wallet.confirm_purchase', { amount: (effectiveAmount || 0).toFixed(2) })
            )}
          </button>

          <p className="text-[10px] text-stone-500 text-center mt-4 leading-relaxed">
            {t('wallet.secure_payment_notice')}
          </p>
        </>
      )}
    </div>
  );
}

export default function WalletPurchase() {
  const { t } = useTranslation();

  return (
    <div className="max-w-lg mx-auto px-4 py-12 animate-fadeIn">
      <Link to="/crediti" className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-stone-500 hover:text-gold-400 transition-colors mb-8 w-fit">
        <ArrowLeft className="h-3.5 w-3.5" /> {t('wallet.hero_title')}
      </Link>

      {stripePromise ? (
        <Elements stripe={stripePromise}>
          <CheckoutForm />
        </Elements>
      ) : (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs text-center">
          {t('wallet.stripe_not_configured')}
        </div>
      )}
    </div>
  );
}

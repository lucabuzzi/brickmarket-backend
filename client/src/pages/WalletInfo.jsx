import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Coins, Sparkles, Trophy, Gavel, ArrowRight, History, PlusCircle, Landmark } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { apiFetch } from '../api';
import { StitchCard, AnimateCounter } from '../components/StitchComponents';

export default function WalletInfo() {
  const { t } = useTranslation();
  const { user, wallet } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [loadingTx, setLoadingTx] = useState(true);

  const TRANSACTION_LABELS = {
    deposit: { label: t('wallet.tx_deposit'), color: 'text-emerald-400' },
    contest_entry: { label: t('wallet.tx_contest_entry'), color: 'text-pink-400' },
    contest_refund: { label: t('wallet.tx_contest_refund'), color: 'text-emerald-400' },
    shop_purchase: { label: t('wallet.tx_shop_purchase'), color: 'text-gold-400' },
    payout: { label: t('wallet.tx_payout'), color: 'text-stone-400' },
  };

  useEffect(() => {
    document.title = t('wallet.page_title');

    if (!user) {
      setLoadingTx(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch('/api/wallet/transactions');
        if (!cancelled) setTransactions((data?.transactions || []).slice(0, 5));
      } catch (err) {
        console.error('Error fetching wallet transactions:', err);
      } finally {
        if (!cancelled) setLoadingTx(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, t]);

  return (
    <div className="page max-w-[1100px] mx-auto px-4 py-12 animate-fadeIn">
      {/* HERO */}
      <div className="bento-card p-8 md:p-12 relative overflow-hidden mb-10 border border-white/5 bg-[#14120b]/30 rounded-3xl text-center">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gold-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-gold-400 mb-6">
            <Coins className="h-3.5 w-3.5" /> {t('wallet.badge')}
          </div>

          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white mb-4">
            {t('wallet.hero_title')}
          </h1>
          <p className="text-sm text-stone-400 max-w-xl mx-auto leading-relaxed mb-8">
            {t('wallet.hero_subtitle')}
          </p>

          {user ? (
            <div className="inline-flex flex-col items-center gap-1 bg-black/30 border border-white/10 rounded-2xl px-8 py-5 mb-8">
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">{t('wallet.your_balance')}</span>
              <span className="text-4xl font-black text-gold-400 text-glow-cyan font-mono">
                <AnimateCounter value={wallet.balanceCredits || 0} suffix=" CR" />
              </span>
            </div>
          ) : (
            <div className="inline-flex flex-col items-center gap-2 bg-black/30 border border-white/10 rounded-2xl px-8 py-5 mb-8">
              <span className="text-sm text-stone-400">{t('wallet.login_prompt')}</span>
              <Link to="/login" className="text-gold-400 font-bold text-xs uppercase tracking-wider hover:underline">
                {t('wallet.login_cta')}
              </Link>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate(user ? '/crediti/acquista' : '/login')}
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gold-500 hover:bg-gold-400 text-white rounded-xl font-bold uppercase text-sm tracking-wider transition-all shadow-lg shadow-gold-500/25 active-shrink w-full sm:w-auto"
            >
              <PlusCircle className="h-4 w-4" /> {t('wallet.buy_credits_cta')}
            </button>
            <button
              onClick={() => navigate(user ? '/crediti/converti' : '/login')}
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-bold uppercase text-sm tracking-wider transition-all active-shrink w-full sm:w-auto"
            >
              <Landmark className="h-4 w-4" /> {t('wallet.convert_credits_cta')}
            </button>
          </div>
        </div>
      </div>

      {/* EXPLANATION GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <StitchCard glowColor="blue" className="p-6">
          <div className="h-10 w-10 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center text-gold-400 mb-4">
            <Coins className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wide mb-2">{t('wallet.card1_title')}</h3>
          <p className="text-xs text-stone-400 leading-relaxed">
            <span className="text-white font-bold">{t('wallet.exchange_rate')}</span>. {t('wallet.card1_desc')}
          </p>
        </StitchCard>

        <StitchCard glowColor="purple" className="p-6">
          <div className="h-10 w-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 mb-4">
            <Trophy className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wide mb-2">{t('wallet.card2_title')}</h3>
          <p className="text-xs text-stone-400 leading-relaxed">
            {t('wallet.card2_desc')}
          </p>
        </StitchCard>

        <StitchCard glowColor="amber" className="p-6">
          <div className="h-10 w-10 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center text-gold-400 mb-4">
            <Gavel className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wide mb-2">{t('wallet.card3_title')}</h3>
          <p className="text-xs text-stone-400 leading-relaxed">
            {t('wallet.card3_desc')}
          </p>
        </StitchCard>
      </div>

      {/* RECENT TRANSACTIONS */}
      {user && (
        <div className="bento-card p-6 border border-white/5 bg-[#14120b]/30 rounded-2xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-stone-400">
              <History className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wide">{t('wallet.recent_tx_title')}</h2>
              <p className="text-[11px] text-stone-500">{t('wallet.recent_tx_subtitle')}</p>
            </div>
          </div>

          {loadingTx ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-xs text-stone-500 text-center py-6">
              {t('wallet.no_transactions')}
            </p>
          ) : (
            <div className="divide-y divide-white/5">
              {transactions.map((tx) => {
                const meta = TRANSACTION_LABELS[tx.type] || { label: tx.type, color: 'text-stone-400' };
                const isPositive = tx.amount > 0;
                return (
                  <div key={tx.id} className="flex items-center justify-between py-3">
                    <div>
                      <span className={`text-xs font-bold ${meta.color}`}>{meta.label}</span>
                      <p className="text-[10px] text-stone-500 mt-0.5">
                        {new Date(tx.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <span className={`font-mono text-sm font-bold ${isPositive ? 'text-emerald-400' : 'text-stone-300'}`}>
                      {isPositive ? '+' : ''}{parseFloat(tx.amount).toFixed(0)} CR
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {user && (
        <div className="mt-10 text-center">
          <Link
            to="/skill-zone"
            className="inline-flex items-center gap-2 text-xs font-bold text-gold-400 hover:text-gold-300 uppercase tracking-widest"
          >
            {t('wallet.goto_skillzone')} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}

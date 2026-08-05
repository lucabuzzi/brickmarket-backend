import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Search, ShoppingCart, PackagePlus, Gamepad2, Sparkles, ArrowRight,
  Star, Bell, UserCircle2, Coins,
} from 'lucide-react';
import { StitchCard } from '../components/StitchComponents';

export default function HowItWorks() {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = t('how_it_works_page.page_title');
  }, [t]);

  const whyCards = [
    { icon: <Sparkles className="h-5 w-5" />, glow: 'blue', title: t('how_it_works_page.why1_title'), desc: t('how_it_works_page.why1_desc') },
    { icon: <Star className="h-5 w-5" />, glow: 'amber', title: t('how_it_works_page.why2_title'), desc: t('how_it_works_page.why2_desc') },
    { icon: <Gamepad2 className="h-5 w-5" />, glow: 'purple', title: t('how_it_works_page.why3_title'), desc: t('how_it_works_page.why3_desc') },
  ];

  const steps = [
    {
      icon: <Search size={20} />, color: 'text-gold-400 bg-gold-500/10 border-gold-500/20',
      title: t('how_it_works_page.step1_title'), desc: t('how_it_works_page.step1_long_desc'),
      cta: t('how_it_works_page.step1_cta'), to: '/catalog',
    },
    {
      icon: <ShoppingCart size={20} />, color: 'text-gold-400 bg-gold-500/10 border-gold-500/20',
      title: t('how_it_works_page.step2_title'), desc: t('how_it_works_page.step2_long_desc'),
      cta: t('how_it_works_page.step2_cta'), to: '/annunci',
    },
    {
      icon: <PackagePlus size={20} />, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      title: t('how_it_works_page.step3_title'), desc: t('how_it_works_page.step3_long_desc'),
      cta: t('how_it_works_page.step3_cta'), to: '/sell',
    },
    {
      icon: <Gamepad2 size={20} />, color: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
      title: t('how_it_works_page.step4_title'), desc: t('how_it_works_page.step4_long_desc'),
      cta: t('how_it_works_page.step4_cta'), to: '/skill-zone',
    },
  ];

  const features = [
    { icon: <Star className="h-5 w-5" />, glow: 'amber', title: t('how_it_works_page.feature1_title'), desc: t('how_it_works_page.feature1_desc') },
    { icon: <Bell className="h-5 w-5" />, glow: 'blue', title: t('how_it_works_page.feature2_title'), desc: t('how_it_works_page.feature2_desc') },
    { icon: <UserCircle2 className="h-5 w-5" />, glow: 'purple', title: t('how_it_works_page.feature3_title'), desc: t('how_it_works_page.feature3_desc') },
    { icon: <Coins className="h-5 w-5" />, glow: 'emerald', title: t('how_it_works_page.feature4_title'), desc: t('how_it_works_page.feature4_desc') },
  ];

  return (
    <div className="page max-w-[1100px] mx-auto px-4 py-8 md:py-12 animate-fadeIn">
      {/* HERO */}
      <div className="bento-card p-6 md:p-12 relative overflow-hidden mb-10 border border-white/5 bg-[#14120b]/30 rounded-3xl text-center">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gold-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-gold-400 mb-6">
            <Sparkles className="h-3.5 w-3.5" /> {t('how_it_works_page.hero_badge')}
          </div>

          <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tight text-white mb-4 font-mono">
            {t('how_it_works_page.hero_title')}
          </h1>
          <p className="text-sm text-stone-400 max-w-2xl mx-auto leading-relaxed mb-8">
            {t('how_it_works_page.hero_subtitle')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/catalog"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gold-500 hover:bg-gold-400 text-white rounded-xl font-bold uppercase text-xs tracking-wider transition-all shadow-lg shadow-gold-500/25 active-shrink"
            >
              {t('how_it_works_page.hero_cta_catalog')} <ArrowRight size={14} />
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-bold uppercase text-xs tracking-wider transition-all active-shrink"
            >
              {t('how_it_works_page.hero_cta_register')}
            </Link>
          </div>
        </div>
      </div>

      {/* WHY */}
      <div className="mb-10">
        <h2 className="text-lg md:text-xl font-black text-white uppercase tracking-tight font-mono mb-5 text-center">
          {t('how_it_works_page.why_title')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {whyCards.map((c, i) => (
            <StitchCard key={i} glowColor={c.glow} className="p-6">
              <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gold-400 mb-4">
                {c.icon}
              </div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wide mb-2">{c.title}</h3>
              <p className="text-xs text-stone-400 leading-relaxed">{c.desc}</p>
            </StitchCard>
          ))}
        </div>
      </div>

      {/* STEPS */}
      <div className="bento-card p-5 md:p-8 mb-10 border border-white/5 bg-[#14120b]/30 rounded-3xl">
        <div className="mb-6 text-center">
          <h2 className="text-lg md:text-xl font-black text-white uppercase tracking-tight font-mono">
            {t('how_it_works_page.steps_title')}
          </h2>
          <p className="text-xs text-stone-400 mt-1">{t('how_it_works_page.steps_subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {steps.map((step, i) => (
            <div key={i} className="relative flex flex-col gap-3 rounded-2xl border border-white/5 bg-white/2 p-5">
              <div className="flex items-center justify-between">
                <div className={`h-11 w-11 rounded-xl border flex items-center justify-center ${step.color}`}>
                  {step.icon}
                </div>
                <span className="text-xs font-black text-stone-600 font-mono">0{i + 1}</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{step.title}</h3>
                <p className="text-xs text-stone-400 mt-2 leading-relaxed">{step.desc}</p>
              </div>
              <Link
                to={step.to}
                className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-gold-400 hover:text-gold-300 uppercase tracking-wider"
              >
                {step.cta} <ArrowRight size={12} />
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <div className="mb-10">
        <h2 className="text-lg md:text-xl font-black text-white uppercase tracking-tight font-mono mb-5 text-center">
          {t('how_it_works_page.features_title')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f, i) => (
            <div key={i} className="rounded-2xl border border-white/5 bg-white/2 p-5">
              <div className={`h-9 w-9 rounded-xl border flex items-center justify-center mb-3 ${
                f.glow === 'amber' ? 'text-gold-400 bg-gold-500/10 border-gold-500/20'
                : f.glow === 'purple' ? 'text-pink-400 bg-pink-500/10 border-pink-500/20'
                : f.glow === 'emerald' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                : 'text-gold-400 bg-gold-500/10 border-gold-500/20'
              }`}>
                {f.icon}
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5">{f.title}</h3>
              <p className="text-xs text-stone-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FINAL CTA */}
      <div className="bento-card p-8 md:p-10 text-center border border-white/5 bg-[#14120b]/30 rounded-3xl relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 bg-gold-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white mb-3 font-mono">
            {t('how_it_works_page.cta_title')}
          </h2>
          <p className="text-sm text-stone-400 max-w-xl mx-auto leading-relaxed mb-7">
            {t('how_it_works_page.cta_desc')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gold-500 hover:bg-gold-400 text-white rounded-xl font-bold uppercase text-xs tracking-wider transition-all shadow-lg shadow-gold-500/25 active-shrink"
            >
              {t('how_it_works_page.cta_register')} <ArrowRight size={14} />
            </Link>
            <Link
              to="/catalog"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-bold uppercase text-xs tracking-wider transition-all active-shrink"
            >
              {t('how_it_works_page.cta_browse')}
            </Link>
          </div>
        </div>
      </div>

      <div className="flex justify-center mt-8">
        <Link to="/" className="text-xs font-bold text-stone-400 hover:text-white uppercase tracking-widest">
          {t('how_it_works_page.back_to_home')}
        </Link>
      </div>
    </div>
  );
}

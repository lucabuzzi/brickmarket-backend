import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import DragonView from '../components/DragonView';
import legalPages from '../../config/legalPages.json';
import { useLocalizedNav } from '../../routing/useLocalizedNav';

const BRICKS = [
  { left: '6%', top: '14%', c: '#3b82f6', r: '-8deg', d: '0s' },
  { left: '82%', top: '10%', c: '#ff5a36', r: '10deg', d: '1.2s' },
  { left: '14%', top: '72%', c: '#c6ff3d', r: '6deg', d: '2.1s' },
  { left: '74%', top: '68%', c: '#8b5cf6', r: '-12deg', d: '0.6s' },
  { left: '44%', top: '6%', c: '#22d3ee', r: '4deg', d: '1.7s' },
  { left: '90%', top: '44%', c: '#c6ff3d', r: '-5deg', d: '2.6s' },
  { left: '2%', top: '42%', c: '#ff5a36', r: '9deg', d: '3.1s' },
];

/** "PREMI START" screen. Enter / Space also start, like an arcade cabinet. */
export default function TitleScreen({ onStart, busy }) {
  const { t } = useTranslation();
  const navTo = useLocalizedNav();

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onStart(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStart]);

  return (
    <div className="cbg-title relative flex min-h-full flex-col items-center justify-center px-4 py-24 text-center">
      <div className="cbg-bricks" aria-hidden>
        {BRICKS.map((b) => (
          <span key={b.left + b.top} className="cbg-brick" style={{ left: b.left, top: b.top, background: b.c, '--r': b.r, animationDelay: b.d }} />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <div className="cbg-dragon-float relative">
          <div className="cbg-dragon-glow" aria-hidden />
          <DragonView scale={4} />
        </div>
        <h1 className="cbg-pixel cbg-logo mt-4 text-[clamp(1.6rem,7vw,3.4rem)] font-normal uppercase">
          Card<span>brix</span>
        </h1>
        <p className="cbg-pixel mt-3 text-[clamp(0.7rem,2.6vw,1.1rem)] uppercase" style={{ color: '#22d3ee', textShadow: '3px 3px 0 #000' }}>the game!</p>
        <p className="mt-6 max-w-md text-base text-white/70">{t('game.tagline')}</p>

        <button type="button" onClick={onStart} disabled={busy} className="cbg-btn mt-12 px-8">
          <span className="cbg-blink" aria-hidden>▶</span> {t('game.press_start')}
        </button>

        <p className="mt-8 text-xs text-white/50">{t('game.age_note')}</p>
        {legalPages.published && (
          <p className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-white/60">
            <Link to={navTo('/privacy')} className="underline hover:text-white">{t('footer.privacy')}</Link>
            <Link to={navTo('/cookie-policy')} className="underline hover:text-white">{t('footer.cookie_policy')}</Link>
          </p>
        )}
      </div>
    </div>
  );
}

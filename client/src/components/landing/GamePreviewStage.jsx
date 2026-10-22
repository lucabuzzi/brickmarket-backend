import { useState } from 'react';
import dragonStatue from '../../assets/game/dragon-statue.png';
import uomoBase from '../../assets/game/skins/uomo_base.png';
import uomoCyber from '../../assets/game/skins/uomo_cyber.png';
import donnaBase from '../../assets/game/skins/donna_base.png';
import donnaCyber from '../../assets/game/skins/donna_cyber.png';
import './gamePreview.css';

const SHEETS = [uomoBase, uomoCyber, donnaBase, donnaCyber];

const COINS = [
  { left: '12%', top: '30%', d: '0s' }, { left: '24%', top: '14%', d: '0.6s' }, { left: '38%', top: '38%', d: '1.1s' },
  { left: '62%', top: '36%', d: '0.3s' }, { left: '76%', top: '16%', d: '0.9s' }, { left: '88%', top: '32%', d: '1.5s' },
];
const CARDS = [
  { left: '8%', top: '52%', c: '#c6ff3d', d: '0.2s' }, { left: '90%', top: '50%', c: '#ff5a36', d: '0.8s' },
  { left: '30%', top: '8%', c: '#8b5cf6', d: '1.2s' }, { left: '70%', top: '8%', c: '#3b82f6', d: '0.5s' },
];
const BRICKS = [
  { left: '6%', bottom: '4%', c: '#e53935' }, { left: '34%', bottom: '3%', c: '#ffd23f' }, { left: '58%', bottom: '5%', c: '#2f6fe0' }, { left: '84%', bottom: '3%', c: '#2fa84f' },
];
const SPARKS = [{ left: '42%', top: '24%' }, { left: '58%', top: '20%' }, { left: '36%', top: '46%' }, { left: '66%', top: '44%' }];

/**
 * The animated mini-scene on the home-page card: the CardBrix dragon on its plaza and one of the four heroes (picked
 * at random) walking up and down a brick path. Pure CSS animation: no game engine is loaded for it. Decorative only.
 */
export default function GamePreviewStage() {
  const [sheet] = useState(() => SHEETS[Math.floor(Math.random() * SHEETS.length)]);
  const heroStyle = { backgroundImage: `url(${sheet})` };

  return (
    <div className="gps" aria-hidden>
      <div className="gps-sky" />
      <div className="gps-ground" />
      {BRICKS.map((b) => <span key={b.left} className="gps-brick" style={{ left: b.left, bottom: b.bottom, background: b.c }} />)}
      <div className="gps-path" />

      <div className="gps-dragon">
        <div className="gps-glow" />
        <img className="gps-dragon-img" src={dragonStatue} alt="" width="311" height="260" decoding="async" />
      </div>

      <div className="gps-hero gps-hero--right"><div className="gps-sprite gps-sprite--right" style={heroStyle} /></div>
      <div className="gps-hero gps-hero--left"><div className="gps-sprite gps-sprite--left" style={heroStyle} /></div>

      {COINS.map((c) => <span key={c.left} className="gps-coin" style={{ left: c.left, top: c.top, animationDelay: c.d }} />)}
      {CARDS.map((c) => <span key={c.left + c.top} className="gps-card" style={{ left: c.left, top: c.top, animationDelay: c.d, '--card': c.c }} />)}
      {SPARKS.map((s) => <span key={s.left + s.top} className="gps-spark" style={{ left: s.left, top: s.top }} />)}
    </div>
  );
}

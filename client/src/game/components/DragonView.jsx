import { useEffect, useRef } from 'react';
import { DRAGON_W, DRAGON_H, renderDragon } from '../../lib/game/dragonSprite';

/** The CardBrix dragon as crisp pixel art (integer `scale`), used on the title screen and the victory card. */
export default function DragonView({ scale = 4, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) renderDragon(ctx, 0, 0);
  }, []);
  return (
    <canvas
      ref={ref}
      width={DRAGON_W}
      height={DRAGON_H}
      aria-hidden
      className={className}
      style={{ width: DRAGON_W * scale, height: DRAGON_H * scale, imageRendering: 'pixelated', maxWidth: '100%' }}
    />
  );
}

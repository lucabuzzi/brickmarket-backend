import { useEffect, useRef } from 'react';
import { FRAME, IDLE_COL, frameRect } from '../../lib/game/skins';
import useAvatarSheet from '../useAvatarSheet';

/**
 * The character on a canvas. `dir` is 'down' | 'up' | 'right' | 'left'; `walking` loops the walk frames.
 * `scale` is an integer so the pixels stay crisp (image-rendering: pixelated).
 */
export default function AvatarPreview({ avatar, dir = 'down', walking = false, scale = 5, className = '', label }) {
  const ref = useRef(null);
  const sheet = useAvatarSheet(avatar);

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx || !sheet) return undefined;
    ctx.imageSmoothingEnabled = false;
    let col = IDLE_COL[dir];
    const paint = () => {
      ctx.clearRect(0, 0, FRAME.w, FRAME.h);
      const r = frameRect(dir, col);
      ctx.drawImage(sheet, r.x, r.y, r.w, r.h, 0, 0, FRAME.w, FRAME.h);
    };
    paint();
    if (!walking) return undefined;
    const id = setInterval(() => { col = (col + 1) % 4; paint(); }, 170);
    return () => clearInterval(id);
  }, [sheet, dir, walking]);

  return (
    <canvas
      ref={ref}
      width={FRAME.w}
      height={FRAME.h}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={className}
      style={{ width: FRAME.w * scale, height: FRAME.h * scale, imageRendering: 'pixelated', maxWidth: '100%' }}
    />
  );
}

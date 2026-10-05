import { createElement } from 'react';
import { GLYPHS } from '../../lib/sell/glyphs';

// Draws the little line illustration of a suggested shot (data in lib/sell/glyphs.js).
function draw([tag, attrs, child], key) {
  return createElement(tag, { key, ...attrs }, child ? draw(child, 0) : undefined);
}

export default function ShotGlyph({ id, size = 40, className = '' }) {
  const parts = GLYPHS[id];
  if (!parts) return null;
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {parts.map((part, i) => draw(part, i))}
    </svg>
  );
}

// Little line illustrations for every suggested shot, as plain data (64x64 viewBox, drawn with a stroke).
// The component renders them with React.createElement, so there is no raw markup anywhere, and a test checks
// that every shot has one. Each entry is a list of [tag, attributes].
const rect = (x, y, w, h, rx = 0, extra = {}) => ['rect', { x, y, width: w, height: h, ...(rx ? { rx } : {}), ...extra }];
const path = (d, extra = {}) => ['path', { d, ...extra }];
const circle = (cx, cy, r, extra = {}) => ['circle', { cx, cy, r, ...extra }];

const BOX = rect(14, 10, 36, 44, 3);
const CARD = rect(16, 6, 32, 48, 3);

export const GLYPHS = {
  box_front: [BOX, rect(20, 32, 24, 14, 2), rect(24, 26, 6, 6), rect(34, 26, 6, 6)], // the box art: a brick
  box_back: [BOX, path('M20 20h24M20 27h24M20 34h14'), rect(38, 40, 8, 8)],
  box_corners: [path('M14 50V20a6 6 0 0 1 6-6h30'), path('M14 50h14M50 14v14', { strokeDasharray: '3 4' }), circle(14, 14, 4)],
  contents: [rect(8, 32, 20, 20, 2), rect(34, 22, 22, 30, 2), circle(18, 19, 7)],
  flaws: [circle(28, 28, 15), path('M39 39l16 16'), path('M20 30l9-6')],
  overview: [path('M6 52h52'), rect(14, 32, 36, 20, 2), rect(22, 20, 14, 12, 2)],
  closeup: [rect(8, 8, 48, 48, 5, { strokeDasharray: '4 4' }), circle(32, 32, 13), circle(32, 32, 4)],
  other_side: [rect(23, 23, 18, 18, 2), path('M50 26a19 19 0 1 0 1 14'), path('M51 12v14H37')],
  details: [path('M32 8l6 17 17 6-17 6-6 17-6-17-17-6 17-6z')],
  scale: [rect(10, 22, 26, 30, 2), circle(47, 44, 9), path('M8 58h48')],
  box_side: [BOX, rect(21, 17, 22, 26, 2), circle(32, 27, 5)],
  card_front: [CARD, rect(21, 12, 22, 20, 1), path('M21 38h22M21 44h14')],
  card_back: [CARD, circle(32, 30, 11), path('M21 30h22M32 19v22')],
  card_corners: [rect(16, 6, 32, 48, 3, { strokeDasharray: '3 4', opacity: 0.45 }), path('M16 18V9a3 3 0 0 1 3-3h9M48 18V9a3 3 0 0 0-3-3h-9M16 42v9a3 3 0 0 0 3 3h9M48 42v9a3 3 0 0 1-3 3h-9')],
  card_light: [['g', { transform: 'rotate(-16 34 32)' }, rect(20, 10, 28, 44, 3)], path('M6 14l9 6M4 27l10 2M8 41l9-3')],
  card_extra: [rect(14, 6, 36, 52, 4), rect(20, 12, 24, 36, 2), path('M20 53h24')],
};

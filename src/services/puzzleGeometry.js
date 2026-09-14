// Server-side mirror of the layout math in client/src/components/JigsawPuzzle.jsx
// (gridRows/gridCols/boardWidth/boardHeight/pieceWidth/pieceHeight/canvasWidth/
// canvasHeight/boardX/boardY). Kept deliberately as plain arithmetic, not a
// shared import, because the two sides run in different runtimes (browser
// canvas vs Node) — but they MUST stay numerically identical, since this is
// what lets the server independently recompute "is this piece actually in
// the right place" without trusting anything the client claims about it.
// If the client's layout constants ever change, update computeLayout() here
// to match, in the same commit.
//
// What's authoritative here vs. cosmetic-only on the client:
//   - grid dimensions, piece target positions, "rotation must be 0" — THIS
//     is what "solved" means, and it's what gets verified.
//   - scatter starting positions, jigsaw tab bezier shapes, initial random
//     rotation — purely visual/gameplay flavor on the client, irrelevant to
//     whether a submitted piece is in its correct final spot, so none of
//     that needs a server-side equivalent.

function computeGridDimensions(isPortrait) {
  return isPortrait ? { gridRows: 6, gridCols: 5 } : { gridRows: 5, gridCols: 6 };
}

/** True for the (gridRows, gridCols) pair the server stored at /start —
 *  the two valid shapes are distinguishable by which dimension is larger. */
function isPortraitFromGrid(gridRows, gridCols) {
  return gridRows > gridCols;
}

function computeLayout(isPortrait) {
  const { gridRows, gridCols } = computeGridDimensions(isPortrait);
  const boardWidth = isPortrait ? 300 : 600;
  const boardHeight = isPortrait ? 600 : 300;
  const pieceWidth = boardWidth / gridCols;
  const pieceHeight = boardHeight / gridRows;
  const canvasWidth = isPortrait ? 450 : 800;
  const canvasHeight = isPortrait ? 800 : 450;
  const boardX = (canvasWidth - boardWidth) / 2;
  const boardY = (canvasHeight - boardHeight) / 2;
  return { gridRows, gridCols, boardWidth, boardHeight, pieceWidth, pieceHeight, canvasWidth, canvasHeight, boardX, boardY };
}

function layoutFromStoredGrid(gridRows, gridCols) {
  return computeLayout(isPortraitFromGrid(gridRows, gridCols));
}

/** Piece ids are assigned client-side as `row * gridCols + col` (see
 *  JigsawPuzzle.jsx's startGame) — deterministic, so the target pixel
 *  position for any id is fully recoverable from the grid dimensions alone. */
function targetForPiece(pieceId, layout) {
  const { gridCols, gridRows, boardX, boardY, pieceWidth, pieceHeight } = layout;
  const row = Math.floor(pieceId / gridCols);
  const col = pieceId % gridCols;
  const inRange = pieceId >= 0 && row >= 0 && row < gridRows && col >= 0 && col < gridCols;
  return { targetX: boardX + col * pieceWidth, targetY: boardY + row * pieceHeight, row, col, inRange };
}

// Tight tolerance: a genuinely locked piece is snapped to the EXACT target
// client-side the moment it locks (JigsawPuzzle.jsx sets piece.x = targetX,
// piece.y = targetY on lock) — this only needs to absorb floating-point
// drift, not the ±15px drag tolerance the client uses to decide whether to
// snap in the first place.
const POSITION_TOLERANCE_PX = 4;

function isPieceInPlace(pieceId, x, y, rotation, layout) {
  const { targetX, targetY, inRange } = targetForPiece(pieceId, layout);
  if (!inRange) return false;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(rotation)) return false;
  const dx = Math.abs(x - targetX);
  const dy = Math.abs(y - targetY);
  const normRotation = ((Math.round(rotation) % 360) + 360) % 360;
  return dx <= POSITION_TOLERANCE_PX && dy <= POSITION_TOLERANCE_PX && normRotation === 0;
}

module.exports = {
  computeGridDimensions,
  isPortraitFromGrid,
  computeLayout,
  layoutFromStoredGrid,
  targetForPiece,
  isPieceInPlace,
  POSITION_TOLERANCE_PX,
};

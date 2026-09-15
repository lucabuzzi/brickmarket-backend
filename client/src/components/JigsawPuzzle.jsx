import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { formatRaceTime } from '../api';

export default function JigsawPuzzle({
  imageUrl,
  onComplete,
  onCancel,
  onPieceLocked,
  contestId,
  attemptToken,
  // Decided by the parent BEFORE this component mounts (SkillZone.jsx
  // detects it and sends it to POST /api/contest/start, which is what the
  // server actually checks every locked piece against) — no longer
  // self-detected here, so client and server can never disagree about which
  // of the two grid shapes (5x6 / 6x5, always 30 pieces) is in play.
  isPortrait = false,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [gameState, setGameState] = useState('idle'); // idle, playing, completed, cheated
  const [lockedCount, setLockedCount] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [imageReady, setImageReady] = useState(false);
  const [imageError, setImageError] = useState(false);
  // TEMPORARY diagnostic readout, brought back after being removed before
  // getting real data from it last time — do not remove again until the
  // user has reported what it actually shows on their device.
  const [debugInfo, setDebugInfo] = useState('tap a piece to see debug info');

  // Anti-cheat stats
  const blurCountRef = useRef(0);
  const totalBlurTimeRef = useRef(0);
  const blurStartedAtRef = useRef(0);
  const gameStartedAtRef = useRef(0);
  const timerIntervalRef = useRef(null);

  // Puzzle configuration — fixed 4x4 (16 pieces): the old 5x6/6x5 split (30
  // pieces) made individual pieces too small to drag comfortably on a
  // phone-sized touch target, and a square grid means orientation no
  // longer needs to change piece count at all. isPortrait still swaps the
  // board/canvas pixel dimensions, so the assembled puzzle keeps the source
  // image's own aspect ratio on screen. Kept numerically identical to
  // src/services/puzzleGeometry.js#computeLayout on the server — see that
  // file's comment for why.
  const gridRows = 4;
  const gridCols = 4;
  const totalPieces = gridRows * gridCols;
  const boardWidth = isPortrait ? 320 : 560; // Size of the solved puzzle area
  const boardHeight = isPortrait ? 560 : 320;
  const pieceWidth = boardWidth / gridCols;
  const pieceHeight = boardHeight / gridRows;

  // Canvas bounds (Includes board + surrounding scatter zones). Sized to
  // comfortably fit within a viewport's height at typical zoom without the
  // page needing to scroll during play — see the maxHeight cap on the
  // <canvas> element's style below, which is what actually enforces this
  // (these are just the backing pixel-grid resolution, not the display size).
  const canvasWidth = isPortrait ? 420 : 700;
  const canvasHeight = isPortrait ? 700 : 420;

  // Board offset (Centered on canvas)
  const boardX = (canvasWidth - boardWidth) / 2;
  const boardY = (canvasHeight - boardHeight) / 2;

  // Refs for tracking interactive elements on canvas
  const imageRef = useRef(null);
  const piecesRef = useRef([]);
  const activePieceRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const clickStartRef = useRef({ x: 0, y: 0 });
  // True only once the pointer has actually moved past the drag-start
  // threshold during THIS press — see handleMouseMove/handleMouseUp. Until
  // then the piece doesn't move at all, so a held-but-still tap never
  // drifts, and release always means "rotate" with no time limit.
  const hasDraggedRef = useRef(false);
  const particlesRef = useRef([]); // Locked piece sparkles

  // Synthesize puzzle snap sound dynamically (Web Audio API)
  const playSnapSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(900, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, audioCtx.currentTime + 0.09);
      
      gainNode.gain.setValueAtTime(0.4, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.09);
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.09);
    } catch (err) {
      console.warn('AudioContext failed:', err);
    }
  };

  // Sparkle particle emitter on piece snap
  const emitSparkles = (x, y) => {
    for (let i = 0; i < 20; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6 - 2,
        color: Math.random() < 0.5 ? '#00f0ff' : '#ff007f',
        size: Math.random() * 3 + 2,
        alpha: 1,
        life: 1.0
      });
    }
  };

  // Helper function to draw a single jigsaw piece boundary
  const drawPiecePath = (ctx, x, y, w, h, topTab, rightTab, bottomTab, leftTab) => {
    ctx.beginPath();
    ctx.moveTo(x, y);

    // Helper: draw single edge with bezier curve tab/blank
    const drawEdge = (x1, y1, x2, y2, tabDir) => {
      if (tabDir === 0) {
        ctx.lineTo(x2, y2);
        return;
      }
      
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      
      // Calculate unit vectors and normal vectors
      const ux = dx / len;
      const uy = dy / len;
      const nx = -uy;
      const ny = ux;

      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;

      // Neck coordinates
      const n1x = x1 + dx * 0.38;
      const n1y = y1 + dy * 0.38;
      const n2x = x1 + dx * 0.62;
      const n2y = y1 + dy * 0.62;

      // Tab bulb height
      const tabH = len * 0.22 * tabDir;
      const tcx = cx + nx * tabH;
      const tcy = cy + ny * tabH;

      // Bezier handles
      const cp1x = n1x + nx * tabH * 0.5;
      const cp1y = n1y + ny * tabH * 0.5;
      const cp2x = tcx - dx * 0.12;
      const cp2y = tcy - dy * 0.12;
      const cp3x = tcx + dx * 0.12;
      const cp3y = tcy + dy * 0.12;
      const cp4x = n2x + nx * tabH * 0.5;
      const cp4y = n2y + ny * tabH * 0.5;

      ctx.lineTo(n1x, n1y);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, tcx, tcy);
      ctx.bezierCurveTo(cp3x, cp3y, cp4x, cp4y, n2x, n2y);
      ctx.lineTo(x2, y2);
    };

    // Top: Left to Right
    drawEdge(x, y, x + w, y, topTab);
    // Right: Top to Bottom
    drawEdge(x + w, y, x + w, y + h, rightTab);
    // Bottom: Right to Left
    drawEdge(x + w, y + h, x, y + h, bottomTab);
    // Left: Bottom to Top
    drawEdge(x, y + h, x, y, leftTab);

    ctx.closePath();
  };

  // Start the actual game session
  const startGame = () => {
    gameStartedAtRef.current = Date.now();
    setGameState('playing');
    setLockedCount(0);
    setElapsedTime(0);

    // Start UI timer (F1-style race clock — updates fast enough for a live centisecond readout)
    timerIntervalRef.current = setInterval(() => {
      setElapsedTime(Date.now() - gameStartedAtRef.current);
    }, 50);

    // Initialize puzzle pieces
    const tempPieces = [];
    const borderMatrix = {
      horizontal: Array(gridRows + 1).fill(null).map(() => Array(gridCols).fill(0)),
      vertical: Array(gridRows).fill(null).map(() => Array(gridCols + 1).fill(0))
    };

    // Pre-determine all random interlocking tab direction coordinates
    for (let r = 0; r <= gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        if (r > 0 && r < gridRows) {
          borderMatrix.horizontal[r][c] = Math.random() < 0.5 ? 1 : -1;
        }
      }
    }
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c <= gridCols; c++) {
        if (c > 0 && c < gridCols) {
          borderMatrix.vertical[r][c] = Math.random() < 0.5 ? 1 : -1;
        }
      }
    }

    // Build the pieces list
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        // Correct position inside target board
        const targetX = boardX + c * pieceWidth;
        const targetY = boardY + r * pieceHeight;

        // Outer borders are flat (0). Inner complementaries are read from matrix.
        const topTab = borderMatrix.horizontal[r][c];
        const bottomTab = -borderMatrix.horizontal[r + 1][c];
        const leftTab = borderMatrix.vertical[r][c];
        const rightTab = -borderMatrix.vertical[r][c + 1];

        // Scatter starting positions in border lanes
        let scatterX, scatterY;
        const roll = Math.random();
        if (roll < 0.25) { // Left strip
          scatterX = Math.random() * (boardX - pieceWidth - 20) + 10;
          scatterY = Math.random() * (canvasHeight - pieceHeight - 20) + 10;
        } else if (roll < 0.5) { // Right strip
          scatterX = boardX + boardWidth + 10 + Math.random() * (canvasWidth - (boardX + boardWidth) - pieceWidth - 20);
          scatterY = Math.random() * (canvasHeight - pieceHeight - 20) + 10;
        } else if (roll < 0.75) { // Top strip
          scatterX = Math.random() * (canvasWidth - pieceWidth - 20) + 10;
          scatterY = Math.random() * (boardY - pieceHeight - 20) + 10;
        } else { // Bottom strip
          scatterX = Math.random() * (canvasWidth - pieceWidth - 20) + 10;
          scatterY = boardY + boardHeight + 10 + Math.random() * (canvasHeight - (boardY + boardHeight) - pieceHeight - 20);
        }

        // Apply random starting rotations (90, 180, 270 degrees)
        const rotations = [90, 180, 270];
        const initialRotation = rotations[Math.floor(Math.random() * rotations.length)];

        tempPieces.push({
          id: r * gridCols + c,
          col: c,
          row: r,
          x: scatterX,
          y: scatterY,
          targetX,
          targetY,
          rotation: initialRotation, // Rotation in degrees
          isLocked: false,
          topTab,
          rightTab,
          bottomTab,
          leftTab
        });
      }
    }

    piecesRef.current = tempPieces;
  };

  // Anti-cheat tab visibility change listeners.
  //
  // On mobile, document.hidden can flip briefly for reasons that have
  // nothing to do with actually switching apps: a drag gesture that starts
  // or ends near a reserved OS-gesture edge (iOS Control Center / App
  // Switcher swipe zones, in particular) can brush the browser into the
  // background for a fraction of a second even though the page itself set
  // touch-action: none — that's an OS-level reservation no web page can
  // override. A player fumbling with small pieces near the screen edges is
  // exactly the scenario most likely to trigger this, so a flat "any hidden
  // time counts" rule produced false positives on real devices. Very short
  // episodes are now ignored entirely rather than accumulated; only what's
  // left is checked against the (also raised) total. Must match
  // MAX_TOTAL_BLUR_MS in src/controllers/contestController.js, which
  // independently re-checks whatever total this reports.
  const MIN_BLUR_EPISODE_MS = 1200;
  const MAX_TOTAL_BLUR_MS = 20000;

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (gameState !== 'playing') return;

      if (document.hidden) {
        blurCountRef.current += 1;
        blurStartedAtRef.current = Date.now();
      } else {
        if (blurStartedAtRef.current > 0) {
          const blurredDuration = Date.now() - blurStartedAtRef.current;
          blurStartedAtRef.current = 0;

          if (blurredDuration < MIN_BLUR_EPISODE_MS) {
            console.log(`Tab resumed. Blurred duration: ${blurredDuration}ms — below the noise floor, not counted.`);
            return;
          }

          totalBlurTimeRef.current += blurredDuration;
          console.warn(`Tab resumed. Blurred duration: ${blurredDuration}ms. Acc: ${totalBlurTimeRef.current}ms.`);

          // Alert user of focus compliance rules
          if (totalBlurTimeRef.current > MAX_TOTAL_BLUR_MS) {
            setGameState('cheated');
            clearInterval(timerIntervalRef.current);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [gameState]);

  // Tear down the race-clock interval only on unmount — this used to live in the
  // anti-cheat effect's cleanup above, but that effect re-runs on every gameState
  // change (including idle -> playing), so its cleanup was clearing the interval
  // startGame() had just created, freezing the TICKER at 0 for the whole match.
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  // Load and cache the product image for canvas drawing. Orientation is no
  // longer detected here — it arrives as the isPortrait prop, already
  // agreed with the server at /start.
  useEffect(() => {
    setImageError(false);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      setImageReady(true);
    };
    img.onerror = () => {
      setImageError(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Build the board once orientation-dependent dimensions (gridRows/canvasWidth/etc) are settled
  useEffect(() => {
    if (imageReady) {
      startGame();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageReady, isPortrait]);

  // Canvas Drawing and Animation Loop
  useEffect(() => {
    if (gameState === 'idle') return;

    let animId;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      // 1. Clear background
      ctx.fillStyle = '#09090e';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // 2. Draw outer grid framework (decorations)
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvasWidth; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvasHeight); ctx.stroke();
      }
      for (let y = 0; y < canvasHeight; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvasWidth, y); ctx.stroke();
      }

      // 3. Draw solved target board silhouette (neon dropzone)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.01)';
      ctx.fillRect(boardX, boardY, boardWidth, boardHeight);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.1)';
      ctx.lineWidth = 2;
      ctx.strokeRect(boardX - 2, boardY - 2, boardWidth + 4, boardHeight + 4);

      // Ghost outline of each cell's REAL interlocking shape (tabs and all),
      // not just a straight row/column grid — shows the player what shape
      // to look for at each spot, not only where. Drawn at each piece's
      // target (not current) position, before the pieces themselves, so a
      // locked piece's real artwork naturally covers its own outline once
      // filled — nothing extra to clear.
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.14)';
      ctx.lineWidth = 1;
      piecesRef.current.forEach((p) => {
        drawPiecePath(ctx, p.targetX, p.targetY, pieceWidth, pieceHeight, p.topTab, p.rightTab, p.bottomTab, p.leftTab);
        ctx.stroke();
      });

      // 4. Render unlocked pieces first (so locked ones sink, or vice versa. Usually, locked pieces should be drawn underneath)
      const lockedPieces = piecesRef.current.filter(p => p.isLocked);
      const freePieces = piecesRef.current.filter(p => !p.isLocked);

      // Draw locked pieces (integrated into background canvas)
      lockedPieces.forEach(p => drawPiece(ctx, p));

      // Draw unlocked pieces
      freePieces.forEach(p => drawPiece(ctx, p));

      // Draw active dragged piece on very top
      if (activePieceRef.current && !activePieceRef.current.isLocked) {
        drawPiece(ctx, activePieceRef.current, true);
      }

      // 5. Update and Draw Particles (Sparkles)
      particlesRef.current.forEach((pt, index) => {
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.alpha -= 0.02;
        ctx.save();
        ctx.globalAlpha = pt.alpha;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (pt.alpha <= 0) {
          particlesRef.current.splice(index, 1);
        }
      });

      animId = requestAnimationFrame(draw);
    };

    // Draw single jigsaw piece on canvas
    const drawPiece = (ctx, piece, isFocused = false) => {
      if (!imageRef.current) return;

      ctx.save();

      // Transform context to rotate the piece around its center point
      const centerX = piece.x + pieceWidth / 2;
      const centerY = piece.y + pieceHeight / 2;
      ctx.translate(centerX, centerY);
      ctx.rotate((piece.rotation * Math.PI) / 180);

      // Clip canvas path using the Jigsaw Bezier mask
      drawPiecePath(ctx, -pieceWidth / 2, -pieceHeight / 2, pieceWidth, pieceHeight, piece.topTab, piece.rightTab, piece.bottomTab, piece.leftTab);
      ctx.clip();

      // Draw image sliced area inside the mask
      // Image source crop box
      const sx = piece.col * (imageRef.current.width / gridCols);
      const sy = piece.row * (imageRef.current.height / gridRows);
      const sw = imageRef.current.width / gridCols;
      const sh = imageRef.current.height / gridRows;

      // Tabs bulge up to ~22% of the edge length outside the piece's own square —
      // draw the image oversized (padding > that bulge) so the tab/socket areas are
      // filled with the neighboring piece's artwork instead of empty canvas (black).
      // The clip mask above still confines the paint to this piece's silhouette, and
      // flat (non-tab) borders stay exactly at the square edge since their mask has no bulge.
      const padX = pieceWidth * 0.3;
      const padY = pieceHeight * 0.3;
      const srcPadX = sw * 0.3;
      const srcPadY = sh * 0.3;

      ctx.drawImage(
        imageRef.current,
        sx - srcPadX, sy - srcPadY, sw + srcPadX * 2, sh + srcPadY * 2,
        -pieceWidth / 2 - padX, -pieceHeight / 2 - padY, pieceWidth + padX * 2, pieceHeight + padY * 2
      );

      // Draw border stroke
      ctx.restore();
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate((piece.rotation * Math.PI) / 180);

      drawPiecePath(ctx, -pieceWidth / 2, -pieceHeight / 2, pieceWidth, pieceHeight, piece.topTab, piece.rightTab, piece.bottomTab, piece.leftTab);
      
      if (piece.isLocked) {
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (isFocused) {
        ctx.strokeStyle = '#ff007f';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#ff007f';
        ctx.shadowBlur = 10;
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.restore();
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [gameState]);

  // Click & Drag-Drop Mouse Events
  const getMousePos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    // Support Touch and Mouse events. On touchend/touchcancel, e.touches is
    // already empty (the lifted finger is only in changedTouches), so fall
    // back to that — otherwise every touch release throws reading clientX
    // of undefined and the drag/rotate/snap never registers on mobile.
    const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    const clientX = touch ? touch.clientX : e.clientX;
    const clientY = touch ? touch.clientY : e.clientY;

    // Scale appropriately based on CSS boundaries
    return {
      x: ((clientX - rect.left) / rect.width) * canvasWidth,
      y: ((clientY - rect.top) / rect.height) * canvasHeight
    };
  };

  const handleMouseDown = (e) => {
    if (gameState !== 'playing') {
      setDebugInfo(`DOWN ignored — gameState="${gameState}" (not "playing")`);
      return;
    }
    e.preventDefault();

    const { x, y } = getMousePos(e);
    clickStartRef.current = { x, y };
    hasDraggedRef.current = false;

    // Find clicked piece (Check from top of stack first, unlocked pieces only)
    const candidates = piecesRef.current.filter(p => !p.isLocked);
    let selected = null;

    // Expanded hit box (extra margin helps finger-sized touch targets on mobile)
    const hitPad = e.touches ? 22 : 10;
    for (let i = candidates.length - 1; i >= 0; i--) {
      const p = candidates[i];
      if (x >= p.x - hitPad && x <= p.x + pieceWidth + hitPad &&
          y >= p.y - hitPad && y <= p.y + pieceHeight + hitPad) {
        selected = p;
        break;
      }
    }

    if (selected) {
      activePieceRef.current = selected;
      isDraggingRef.current = true; // gesture in progress — not yet "actively moving the piece", see handleMouseMove
      dragOffsetRef.current = { x: x - selected.x, y: y - selected.y };

      // Put selected piece at the end of the array to draw on top of other free pieces
      piecesRef.current = [
        ...piecesRef.current.filter(p => p.id !== selected.id),
        selected
      ];
    }

    const r = canvasRef.current.getBoundingClientRect();
    setDebugInfo(
      `DOWN ${e.touches ? 'touch' : 'mouse'} canvasPos=(${x.toFixed(0)},${y.toFixed(0)}) `
      + `hit=${selected ? `#${selected.id}@rot${selected.rotation}` : 'NONE'} `
      + `rectPx=${r.width.toFixed(0)}x${r.height.toFixed(0)} pieceUnits=${pieceWidth.toFixed(0)}x${pieceHeight.toFixed(0)}`
    );
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current || !activePieceRef.current || gameState !== 'playing') return;
    if (e.touches && e.cancelable) e.preventDefault();

    const { x, y } = getMousePos(e);
    const piece = activePieceRef.current;

    if (!hasDraggedRef.current) {
      // Piece stays put until the pointer has genuinely moved away from
      // where it was picked up — a held-but-still finger (natural tremor,
      // hesitation while deciding to rotate) never makes it drift, and the
      // eventual release still counts as an unambiguous tap. Scaled to the
      // piece's own size for touch, since a real repositioning drag moves a
      // piece tens to hundreds of px (pieces start scattered well outside
      // the board) — nowhere near this threshold — while mouse keeps the
      // original tight 6px (a real click never wants this generosity).
      const isTouch = !!(e.touches?.length);
      const dragStartThreshold = isTouch ? Math.min(pieceWidth, pieceHeight) * 0.45 : 6;
      const movedSoFar = Math.sqrt(
        Math.pow(x - clickStartRef.current.x, 2) + Math.pow(y - clickStartRef.current.y, 2)
      );
      if (movedSoFar < dragStartThreshold) return; // still within tap tolerance — ignore, piece doesn't move
      hasDraggedRef.current = true; // threshold crossed — this gesture is now a real drag, permanently, for the rest of this press
    }

    // Boundary constraints (Stay on screen)
    piece.x = Math.max(0, Math.min(canvasWidth - pieceWidth, x - dragOffsetRef.current.x));
    piece.y = Math.max(0, Math.min(canvasHeight - pieceHeight, y - dragOffsetRef.current.y));
  };

  const handleMouseUp = () => {
    if (gameState !== 'playing') return;

    if (activePieceRef.current) {
      const piece = activePieceRef.current;

      if (!hasDraggedRef.current) {
        // A: TAP/CLICK — the drag threshold was never crossed during this
        // whole press, no matter how long it was held, so this is always a
        // rotate. +90° renders clockwise (ctx.rotate() with a positive
        // angle does, see drawPiece below).
        const before = piece.rotation;
        piece.rotation = (piece.rotation + 90) % 360;
        console.log(`Rotated piece ${piece.id} to ${piece.rotation}°`);
        setDebugInfo(`UP: piece #${piece.id} ROTATED ${before}°→${piece.rotation}°`);
      } else {
        // B: DRAG END — snap-matching check
        const dx = Math.abs(piece.x - piece.targetX);
        const dy = Math.abs(piece.y - piece.targetY);

        // Snap tolerance: within 15px AND correct 0° rotation
        if (dx < 15 && dy < 15 && piece.rotation === 0) {
          piece.x = piece.targetX;
          piece.y = piece.targetY;
          piece.isLocked = true;

          playSnapSound();
          emitSparkles(piece.x + pieceWidth/2, piece.y + pieceHeight/2);

          // Re-evaluate complete locked count
          const newLockedCount = piecesRef.current.filter(p => p.isLocked).length;
          setLockedCount(newLockedCount);

          console.log(`Piece locked! Progress: ${newLockedCount}/${totalPieces}`);

          // Tell the server — it independently re-verifies this exact piece
          // against its own stored grid before counting it. This is the
          // proof of play /api/contest/complete now requires; the local
          // count above is only ever used for this session's own UI.
          if (onPieceLocked) {
            onPieceLocked({ pieceId: piece.id, x: piece.x, y: piece.y, rotation: piece.rotation });
          }

          setDebugInfo(`UP: piece #${piece.id} LOCKED (dx=${dx.toFixed(0)} dy=${dy.toFixed(0)})`);

          // Trigger completion if all pieces are locked!
          if (newLockedCount === totalPieces) {
            handlePuzzleCompletion();
          }
        } else {
          setDebugInfo(`UP: piece #${piece.id} moved but DID NOT LOCK (hasDragged=true, dx=${dx.toFixed(0)} dy=${dy.toFixed(0)} rot=${piece.rotation}°)`);
        }
      }
    } else {
      setDebugInfo('UP: no piece was selected on the way down (tap missed every piece)');
    }

    activePieceRef.current = null;
    isDraggingRef.current = false;
    hasDraggedRef.current = false;
  };

  // Submit complete details to backend API
  const handlePuzzleCompletion = () => {
    clearInterval(timerIntervalRef.current);
    setGameState('completed');

    // Gather anti-cheat telemetry
    const blurCount = blurCountRef.current;
    const totalBlurTimeMs = totalBlurTimeRef.current;

    // Send backend complete request
    onComplete({
      contestId,
      attemptToken,
      blurCount,
      totalBlurTimeMs
    });
  };

  if (imageError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-10 w-full text-center">
        <AlertTriangle className="h-12 w-12 text-cyber-neonMagenta" />
        <h3 className="text-lg font-extrabold text-cyber-neonMagenta uppercase tracking-wider">
          Puzzle Image Unavailable
        </h3>
        <p className="max-w-md text-sm text-cyber-muted">
          The reference image for this puzzle could not be loaded. Please go back and try another contest.
        </p>
        <button
          onClick={onCancel}
          className="px-6 py-2 border border-cyber-neonMagenta text-cyber-neonMagenta hover:bg-cyber-neonMagenta hover:text-white rounded uppercase text-xs font-bold font-mono transition-all duration-300"
        >
          Back to Lobby
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full">
      {/* Board (left) + reference image (right), nothing else — side by side
          as soon as there's a bit of width (sm:, not the old lg:, so an
          actual landscape phone triggers it too, not just a desktop
          window), stacked only on a narrow portrait screen. */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start justify-center gap-3 sm:gap-6 p-2 sm:p-4 w-full">
        <div className="flex flex-col items-center w-full sm:w-auto sm:flex-1 sm:max-w-[60%]">
          {/* TEMPORARY diagnostic readout — see debugInfo declaration above.
              Do not remove until the user has reported what this shows. */}
          <div style={{ maxWidth: canvasWidth }} className="w-full bg-yellow-400 text-black text-[10px] font-mono font-bold px-2 py-1.5 break-words mb-1">
            🔧 DEBUG: {debugInfo}
          </div>

          {/* Game Canvas Container — TICKER and PROGRESS are now small
              badges overlaid directly on the board itself (top corners)
              instead of a separate bar above it, so nothing fixed eats
              vertical space before the board even starts. */}
          <div className="relative border border-cyber-border bg-[#050508] p-1 shadow-2xl rounded-lg">
            <div className="absolute top-2 left-2 z-10 bg-black/70 backdrop-blur-sm rounded px-2 py-1 font-mono pointer-events-none">
              <span className="text-cyber-neonYellow text-glow-yellow font-bold text-xs tracking-widest">{formatRaceTime(elapsedTime)}</span>
            </div>
            <div className="absolute top-2 right-2 z-10 bg-black/70 backdrop-blur-sm rounded px-2 py-1 font-mono pointer-events-none">
              <span className="text-cyber-neonCyan text-glow-cyan font-bold text-xs">{lockedCount}/{totalPieces}</span>
            </div>

            {/* Anti-cheat compliance alarm */}
            {gameState === 'cheated' && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-6 text-center">
                <ShieldAlert className="h-16 w-16 text-cyber-neonMagenta animate-bounce mb-4" />
                <h3 className="text-xl font-extrabold text-cyber-neonMagenta uppercase tracking-wider text-glow-magenta mb-2">
                  SECURITY PROTOCOL TRIGGERED
                </h3>
                <p className="max-w-md text-sm text-cyber-muted mb-6">
                  Browser focus compliance breach. The system detected that the page lost focus for too long or a cheat trigger occurred. Your entry fees have been logged and voided.
                </p>
                <button
                  onClick={onCancel}
                  className="px-6 py-2 border border-cyber-neonMagenta text-cyber-neonMagenta hover:bg-cyber-neonMagenta hover:text-white rounded uppercase text-xs font-bold font-mono transition-all duration-300"
                >
                  Back to Lobby
                </button>
              </div>
            )}

            <canvas
              ref={canvasRef}
              width={canvasWidth}
              height={canvasHeight}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onTouchStart={handleMouseDown}
              onTouchMove={handleMouseMove}
              onTouchEnd={handleMouseUp}
              // width/height left auto (not forced to 100%) so the browser can
              // shrink either dimension to respect BOTH maxWidth and maxHeight
              // while keeping the aspect ratio — the mechanism that fits the
              // whole board on screen without scrolling.
              style={{
                maxWidth: canvasWidth,
                maxHeight: '82vh',
                aspectRatio: `${canvasWidth} / ${canvasHeight}`,
                width: 'auto',
                height: 'auto',
              }}
              className="block touch-none cursor-grab active:cursor-grabbing max-w-full bg-cyber-bg rounded"
            />
          </div>
        </div>

        {/* Reference image — plain, no card chrome/label, sized to roughly
            pair with the board rather than the small corner thumbnail this
            used to be. */}
        <div className="w-full sm:flex-1 sm:max-w-[60%] flex justify-center">
          <img
            src={imageUrl}
            alt="Original puzzle reference"
            style={{ maxHeight: '82vh' }}
            className="max-w-full object-contain rounded border border-cyber-border/60 bg-black"
            onError={() => setImageError(true)}
          />
        </div>
      </div>

      {/* Abandon — deliberately below the fold (reachable by scrolling
          down), not competing for attention with the board/reference pair
          above. */}
      <div className="flex justify-center pb-6 pt-2">
        <button
          onClick={onCancel}
          className="px-6 py-2 bg-cyber-border hover:bg-red-950/20 hover:border-red-500 border border-transparent rounded text-xs font-bold uppercase transition-all duration-300 text-cyber-muted hover:text-red-400 font-mono"
        >
          Abandon Contest
        </button>
      </div>
    </div>
  );
}

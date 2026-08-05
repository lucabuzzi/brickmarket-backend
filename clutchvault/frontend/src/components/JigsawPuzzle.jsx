import React, { useEffect, useRef, useState } from 'react';
import { EyeOff, AlertTriangle, Play, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function JigsawPuzzle({ 
  imageUrl, 
  onComplete, 
  onCancel,
  contestId,
  attemptToken
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [gameState, setGameState] = useState('idle'); // idle, playing, completed, cheated
  const [lockedCount, setLockedCount] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Anti-cheat stats
  const blurCountRef = useRef(0);
  const totalBlurTimeRef = useRef(0);
  const blurStartedAtRef = useRef(0);
  const gameStartedAtRef = useRef(0);
  const timerIntervalRef = useRef(null);

  // Puzzle configuration
  const gridRows = 5;
  const gridCols = 6;
  const totalPieces = gridRows * gridCols;
  const boardWidth = 600; // Size of the solved puzzle area
  const boardHeight = 300;
  const pieceWidth = boardWidth / gridCols; // 60px
  const pieceHeight = boardHeight / gridRows; // 60px

  // Canvas bounds (Includes board + surrounding scatter zones)
  const canvasWidth = 800;
  const canvasHeight = 450;
  
  // Board offset (Centered on canvas)
  const boardX = (canvasWidth - boardWidth) / 2; // 100px
  const boardY = (canvasHeight - boardHeight) / 2; // 75px

  // Refs for tracking interactive elements on canvas
  const imageRef = useRef(null);
  const piecesRef = useRef([]);
  const activePieceRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const clickStartRef = useRef({ x: 0, y: 0, time: 0 });
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
      const nx = -uy * tabDir;
      const ny = ux * tabDir;

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

    // Start UI timer
    timerIntervalRef.current = setInterval(() => {
      setElapsedTime(Math.round((Date.now() - gameStartedAtRef.current) / 1000));
    }, 1000);

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

  // Anti-cheat tab visibility change listeners
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (gameState !== 'playing') return;

      if (document.hidden) {
        blurCountRef.current += 1;
        blurStartedAtRef.current = Date.now();
      } else {
        if (blurStartedAtRef.current > 0) {
          const blurredDuration = Date.now() - blurStartedAtRef.current;
          totalBlurTimeRef.current += blurredDuration;
          blurStartedAtRef.current = 0;
          
          console.warn(`Tab resumed. Blurred duration: ${blurredDuration}ms. Acc: ${totalBlurTimeRef.current}ms.`);
          
          // Alert user of focus compliance rules
          if (totalBlurTimeRef.current > 15000) {
            setGameState('cheated');
            clearInterval(timerIntervalRef.current);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [gameState]);

  // Load and cache product image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      startGame();
    };
    img.src = imageUrl;
  }, [imageUrl]);

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

      // Draw faint guidelines inside the dropzone
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.lineWidth = 1;
      for (let c = 1; c < gridCols; c++) {
        ctx.beginPath();
        ctx.moveTo(boardX + c * pieceWidth, boardY);
        ctx.lineTo(boardX + c * pieceWidth, boardY + boardHeight);
        ctx.stroke();
      }
      for (let r = 1; r < gridRows; r++) {
        ctx.beginPath();
        ctx.moveTo(boardX, boardY + r * pieceHeight);
        ctx.lineTo(boardX + boardWidth, boardY + r * pieceHeight);
        ctx.stroke();
      }

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

      ctx.drawImage(
        imageRef.current,
        sx, sy, sw, sh,
        -pieceWidth / 2, -pieceHeight / 2, pieceWidth, pieceHeight
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
    // Support Touch and Mouse events
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    // Scale appropriately based on CSS boundaries
    return {
      x: ((clientX - rect.left) / rect.width) * canvasWidth,
      y: ((clientY - rect.top) / rect.height) * canvasHeight
    };
  };

  const handleMouseDown = (e) => {
    if (gameState !== 'playing') return;
    e.preventDefault();

    const { x, y } = getMousePos(e);
    clickStartRef.current = { x, y, time: Date.now() };

    // Find clicked piece (Check from top of stack first, unlocked pieces only)
    const candidates = piecesRef.current.filter(p => !p.isLocked);
    let selected = null;

    for (let i = candidates.length - 1; i >= 0; i--) {
      const p = candidates[i];
      // Collision checking simple box boundary (expand slightly for tabs comfort)
      if (x >= p.x - 10 && x <= p.x + pieceWidth + 10 &&
          y >= p.y - 10 && y <= p.y + pieceHeight + 10) {
        selected = p;
        break;
      }
    }

    if (selected) {
      activePieceRef.current = selected;
      isDraggingRef.current = true;
      dragOffsetRef.current = { x: x - selected.x, y: y - selected.y };

      // Put selected piece at the end of the array to draw on top of other free pieces
      piecesRef.current = [
        ...piecesRef.current.filter(p => p.id !== selected.id),
        selected
      ];
    }
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current || !activePieceRef.current || gameState !== 'playing') return;

    const { x, y } = getMousePos(e);
    const piece = activePieceRef.current;

    // Boundary constraints (Stay on screen)
    piece.x = Math.max(0, Math.min(canvasWidth - pieceWidth, x - dragOffsetRef.current.x));
    piece.y = Math.max(0, Math.min(canvasHeight - pieceHeight, y - dragOffsetRef.current.y));
  };

  const handleMouseUp = (e) => {
    if (gameState !== 'playing') return;
    const clickDuration = Date.now() - clickStartRef.current.time;
    const { x, y } = getMousePos(e);

    const distMoved = Math.sqrt(
      Math.pow(x - clickStartRef.current.x, 2) + Math.pow(y - clickStartRef.current.y, 2)
    );

    if (activePieceRef.current) {
      const piece = activePieceRef.current;

      // A: CLICK EVENT (Short tap with minimal movement => rotate)
      if (clickDuration < 250 && distMoved < 6) {
        piece.rotation = (piece.rotation + 90) % 360;
        console.log(`Rotated piece ${piece.id} to ${piece.rotation}°`);
      } 
      // B: DRAG END EVENT (Snap matching check)
      else {
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

          // Trigger completion if all pieces are locked!
          if (newLockedCount === totalPieces) {
            handlePuzzleCompletion();
          }
        }
      }
    }

    activePieceRef.current = null;
    isDraggingRef.current = false;
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

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div ref={containerRef} className="flex flex-col items-center justify-center p-4 w-full">
      {/* HUD Bar */}
      <div className="flex w-full max-w-[800px] justify-between items-center bg-black/50 border border-cyber-border rounded-t-lg px-6 py-3 font-mono text-sm">
        <div className="flex items-center space-x-2">
          <span className="text-cyber-muted text-xs uppercase font-semibold">TICKER:</span>
          <span className="text-cyber-neonYellow text-glow-yellow font-bold text-base tracking-widest">{formatTime(elapsedTime)}</span>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-cyber-muted text-xs uppercase font-semibold">PROGRESS:</span>
          <div className="w-32 bg-cyber-border h-2 rounded-full overflow-hidden">
            <div 
              className="bg-cyber-neonCyan h-full shadow-neon-cyan transition-all duration-300"
              style={{ width: `${(lockedCount / totalPieces) * 100}%` }}
            ></div>
          </div>
          <span className="text-cyber-neonCyan text-glow-cyan font-bold">{lockedCount}/{totalPieces} PIECES</span>
        </div>
      </div>

      {/* Game Canvas Container */}
      <div className="relative border-x border-b border-cyber-border bg-[#050508] p-1 shadow-2xl rounded-b-lg">
        {/* Anti-cheat compliance alarm */}
        {gameState === 'cheated' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-6 text-center">
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
          className="block cursor-grab active:cursor-grabbing w-full max-w-[800px] aspect-[800/450] bg-cyber-bg rounded"
        />

        {/* Small tips overlay */}
        <div className="absolute bottom-2 right-4 text-[10px] text-cyber-muted pointer-events-none font-mono">
          🖱️ Click/Tap piece to rotate 90° | Drag to match & snap
        </div>
      </div>

      {/* Control panel buttons */}
      <div className="flex space-x-4 mt-6">
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

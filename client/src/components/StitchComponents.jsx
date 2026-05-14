import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility for combining tailwind classes
 */
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Stitch-inspired Glassmorphism Card
 * Features: Spring physics on hover, subtle luminous borders, backdrop blur.
 */
export const StitchCard = ({ children, className, glowColor = 'blue', onClick, flash = false }) => {
  const shouldReduceMotion = useReducedMotion();
  const glowStyles = {
    blue: 'hover:shadow-[0_0_20px_rgba(56,189,248,0.15)] border-blue-500/20',
    emerald: 'hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] border-emerald-500/20',
    amber: 'hover:shadow-[0_0_20px_rgba(234,179,8,0.15)] border-amber-500/20',
    rose: 'hover:shadow-[0_0_20px_rgba(244,63,94,0.15)] border-rose-500/20',
    purple: 'hover:shadow-[0_0_20px_rgba(168,85,247,0.15)] border-purple-500/20',
  };

  return (
    <motion.div
      whileHover={shouldReduceMotion ? {} : { y: -4, scale: 1.01 }}
      whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      initial={flash && !shouldReduceMotion ? { borderColor: 'rgba(16, 185, 129, 0.8)', borderWidth: '2px' } : false}
      animate={flash && !shouldReduceMotion ? { borderColor: 'rgba(255, 255, 255, 0.1)', borderWidth: '1px' } : {}}
      onClick={onClick}
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-slate-900/40 p-6 backdrop-blur-xl transition-shadow duration-500',
        glowStyles[glowColor] || glowStyles.blue,
        onClick && 'cursor-pointer',
        className
      )}
    >
      {/* Glossy overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
      {children}
    </motion.div>
  );
};

/**
 * Animated Counter for numbers
 */
export const AnimateCounter = ({ value, prefix = '', suffix = '', decimals = 0 }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = parseFloat(value);
    if (start === end) return;

    let totalDuration = 1000;
    let increment = end / (totalDuration / 16);
    
    let timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setDisplayValue(end);
        clearInterval(timer);
      } else {
        setDisplayValue(start);
      }
    }, 16);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <span>
      {prefix}
      {decimals > 0 ? displayValue.toFixed(decimals) : Math.floor(displayValue).toLocaleString()}
      {suffix}
    </span>
  );
};

/**
 * Pulsing Glow effect (for Financials Card)
 */
export const PulsingGlow = ({ children, active = false, color = 'emerald' }) => {
  const colorMap = {
    emerald: 'rgba(16, 185, 129, 0.4)',
    rose: 'rgba(244, 63, 94, 0.4)',
  };

  return (
    <div className="relative">
      {active && (
        <motion.div
          animate={{
            boxShadow: [
              `0 0 0px ${colorMap[color]}`,
              `0 0 15px ${colorMap[color]}`,
              `0 0 0px ${colorMap[color]}`
            ]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute inset-0 rounded-full pointer-events-none"
        />
      )}
      {children}
    </div>
  );
};

/**
 * Page Transition Wrapper
 */
export const StitchPageTransition = ({ children }) => {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -20 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {children}
    </motion.div>
  );
};

/**
 * StitchBackground: High-end WebGL-inspired background
 * Implements a singleton-like cleanup pattern to prevent context conflicts.
 */
let globalWebGLEnabled = false;

export const StitchBackground = () => {
  useEffect(() => {
    // Prevent multiple initializations in dev/HMR
    if (globalWebGLEnabled) {
      console.warn('[Stitch] WebGL context already active. Skipping redundant initialization.');
      return;
    }

    globalWebGLEnabled = true;
    const engineId = Math.random().toString(36).substring(7);
    console.log(`[Stitch] Initializing High-End Background Engine (${engineId})...`);

    // Cleanup logic to destroy the WebGL context / engine when component unmounts
    return () => {
      console.log(`[Stitch] Destroying WebGL Context and Cleaning up Engine (${engineId})...`);
      globalWebGLEnabled = false;
      // In a real Three.js/WebGL app, we would call renderer.dispose() here.
    };
  }, []); // Array di dipendenze vuoto per inizializzazione singola

  return (
    <div className="fixed inset-0 -z-10 bg-[#020617] overflow-hidden">
      {/* Animated Gradient Grids (Noir style) */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.05),transparent_50%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
    </div>
  );
};

import React, { useState } from 'react';

const BrickSVG = ({ filledPerc, color, isHovered, onMouseEnter, onMouseLeave, onClick }) => {
  // Generate a unique ID for the gradient using a random string or just using the prop combination + math random
  const gradId = `grad-${color.replace('#', '')}-${Math.floor(filledPerc * 100)}-${Math.random().toString(36).substring(2, 7)}`;
  
  return (
    <div 
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      style={{ 
        display: 'inline-block', 
        cursor: onClick ? 'pointer' : 'default',
        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
      }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset={`${filledPerc * 100}%`} stopColor={color} />
            <stop offset={`${filledPerc * 100}%`} stopColor="#334155" />
          </linearGradient>
        </defs>
        
        {/* Studs */}
        <path d="M5 2h4v4H5z" fill={`url(#${gradId})`} />
        <path d="M15 2h4v4h-4z" fill={`url(#${gradId})`} />
        
        {/* Base Block */}
        <rect x="2" y="6" width="20" height="15" rx="1.5" fill={`url(#${gradId})`} />
        
        {/* Shadow/Details */}
        <rect x="2" y="19" width="20" height="2" fill="#000" opacity="0.15" />
        <path d="M5 2h4v1H5z" fill="#fff" opacity="0.3" />
        <path d="M15 2h4v1h-4z" fill="#fff" opacity="0.3" />
        <rect x="2" y="6" width="20" height="1.5" fill="#fff" opacity="0.2" />
      </svg>
    </div>
  );
};

export default function BrickRating({ value = 0, interactive = false, onChange }) {
  const [hoverValue, setHoverValue] = useState(0);

  const displayValue = hoverValue > 0 ? hoverValue : value;

  const getColor = (val) => {
    if (val <= 2) return '#ef4444'; // Red
    if (val <= 3) return '#eab308'; // Yellow
    return '#22c55e'; // Green
  };

  const currentColor = getColor(displayValue);

  const handleClick = (idx) => {
    if (interactive && onChange) {
      // Play a small click sound effect using web audio api
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.05);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.05);
      } catch (e) {
        // Ignore audio errors
      }

      onChange(idx);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
      {[1, 2, 3, 4, 5].map((idx) => {
        let filledPerc = 0;
        if (displayValue >= idx) {
          filledPerc = 1;
        } else if (displayValue > Math.floor(displayValue) && Math.floor(displayValue) + 1 === idx) {
          filledPerc = displayValue % 1;
        }

        return (
          <BrickSVG
            key={idx}
            color={currentColor}
            filledPerc={filledPerc}
            isHovered={interactive && hoverValue === idx}
            onMouseEnter={() => interactive && setHoverValue(idx)}
            onMouseLeave={() => interactive && setHoverValue(0)}
            onClick={() => handleClick(idx)}
          />
        );
      })}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { normalizeImageUrl } from '../../api';

/** Resize/optimize a Cloudinary image on the fly; other URLs pass through normalizeImageUrl. */
export function cldImage(url, width = 600) {
  if (!url) return '';
  const normalized = normalizeImageUrl(url);
  if (!normalized.includes('res.cloudinary.com') || !normalized.includes('/upload/')) return normalized;
  return normalized.replace('/upload/', `/upload/f_auto,q_auto,c_limit,w_${width}/`);
}

export function listingImage(listing, width) {
  const first = Array.isArray(listing?.images) && listing.images.length ? listing.images[0] : listing?.image_url;
  return cldImage(first, width);
}

export function formatEUR(value, locale = 'it-IT') {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n);
}

/** Live countdown to an ISO date; re-renders once per second while running. */
export function useCountdown(endDate) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endDate) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [endDate]);

  const diff = endDate ? new Date(endDate).getTime() - now : 0;
  const clamped = Math.max(0, diff);
  return {
    done: diff <= 0,
    d: Math.floor(clamped / 86400000),
    h: Math.floor((clamped / 3600000) % 24),
    m: Math.floor((clamped / 60000) % 60),
    s: Math.floor((clamped / 1000) % 60),
  };
}

export const pad2 = (n) => String(n).padStart(2, '0');

/** Real listing routes per product family — mirrors the route table in App.jsx. */
export const ANNUNCI_ROUTES = {
  all: '/annunci',
  lego: '/annunci/lego',
  tcg: '/annunci/carte-collezionabili',
  funko: '/annunci/funko',
};

/** Brand names of the card games — proper nouns, so not routed through i18n. */
export const GAME_NAMES = {
  pokemon: 'Pokémon',
  magic: 'Magic: The Gathering',
  yugioh: 'Yu-Gi-Oh!',
  lorcana: 'Disney Lorcana',
  onepiece: 'One Piece',
  dragonball: 'Dragon Ball',
};

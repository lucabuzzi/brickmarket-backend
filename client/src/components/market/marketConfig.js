import { useEffect, useState } from 'react';
import { apiFetch } from '../../api';
import { ANNUNCI_CARD_GAMES } from '../../config/annunciCategories';

// Two faces of the same marketplace UI: fixed-price listings and live auctions.
// Colours match the landing page pillars (components/landing).
export const MARKET_MODES = {
  listings: {
    key: 'listings',
    base: '/annunci',
    isAuction: false,
    accent: '#c6ff3d',
    accentInk: '#10140a',
    createTo: '/sell',
    defaultSort: 'recent',
    sorts: ['recent', 'price-asc', 'price-desc'],
  },
  auctions: {
    key: 'auctions',
    base: '/aste',
    isAuction: true,
    accent: '#ff5a36',
    accentInk: '#ffffff',
    createTo: '/create-auction',
    defaultSort: 'closing-soon',
    sorts: ['closing-soon', 'recent'],
  },
};

// Top-level product families; `slug` is the URL segment, `productType` the API value.
export const MARKET_CATEGORIES = [
  { slug: 'lego', productType: 'lego', name: 'LEGO', taglineKey: 'hubs.categories.lego_tagline' },
  { slug: 'carte-collezionabili', productType: 'tcg', nameKey: 'hubs.categories.carte_name', taglineKey: 'hubs.categories.carte_tagline' },
  { slug: 'funko', productType: 'funko', name: 'Funko Pop!', taglineKey: 'hubs.categories.funko_tagline' },
];

export const MARKET_CARD_GAMES = ANNUNCI_CARD_GAMES;

export const LEGO_SUBCATEGORIES = ['sets', 'mocs', 'minifigures'];

/** An auction is only worth showing while its clock is still running. */
export function isLiveAuction(item, now = Date.now()) {
  return item.status === 'active' && (!item.auction_end || new Date(item.auction_end).getTime() > now);
}

/** The price a buyer would currently pay/bid against. */
export function displayPrice(item) {
  if (!item.is_auction) return item.price;
  return item.current_bid ?? item.starting_price ?? item.price;
}

/**
 * Loads every active listing (or live auction) for a mode, optionally scoped to one
 * product type / card game, with an explicit reload for the error state's retry button.
 */
export function useMarketItems(mode, { productType, game } = {}) {
  const [state, setState] = useState({ items: [], loading: true, error: '', loadedAt: 0 });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let url = `/api/listings?is_auction=${mode.isAuction}`;
    if (productType) url += `&product_type=${productType}`;
    if (productType === 'tcg' && game) url += `&game=${game}`;

    apiFetch(url)
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        const loadedAt = Date.now();
        setState({ items: mode.isAuction ? list.filter((i) => isLiveAuction(i, loadedAt)) : list, loading: false, error: '', loadedAt });
      })
      .catch((err) => {
        if (!cancelled) setState({ items: [], loading: false, error: err.message || 'error', loadedAt: 0 });
      });

    return () => { cancelled = true; };
  }, [mode.isAuction, productType, game, attempt]);

  const reload = () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    setAttempt((a) => a + 1);
  };

  return { ...state, reload };
}

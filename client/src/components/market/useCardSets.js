import { useEffect, useState } from 'react';
import { apiFetch } from '../../api';

/**
 * The expansions of a game (GET /api/catalog/<game>/sets), grouped by series, newest first. Only fetched when
 * `enabled`. -> { series, loaded } ; a failed request just leaves `series` empty (the pages work without it).
 */
export default function useCardSets(enabled, game = 'pokemon') {
  const [state, setState] = useState({ series: [], loaded: false });

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    apiFetch(`/catalog/${game}/sets`)
      .then((d) => { if (!cancelled) setState({ series: Array.isArray(d?.series) ? d.series : [], loaded: true }); })
      .catch(() => { if (!cancelled) setState({ series: [], loaded: true }); });
    return () => { cancelled = true; };
  }, [enabled, game]);

  return enabled ? state : { series: [], loaded: false };
}

import { useEffect, useState } from 'react';
import { apiFetch } from '../../api';

/**
 * The Pokémon expansions (GET /api/catalog/pokemon/sets), grouped by series, newest first. Only fetched when
 * `enabled`. -> { series, loaded } ; a failed request just leaves `series` empty (the pages work without it).
 */
export default function useCardSets(enabled) {
  const [state, setState] = useState({ series: [], loaded: false });

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    apiFetch('/catalog/pokemon/sets')
      .then((d) => { if (!cancelled) setState({ series: Array.isArray(d?.series) ? d.series : [], loaded: true }); })
      .catch(() => { if (!cancelled) setState({ series: [], loaded: true }); });
    return () => { cancelled = true; };
  }, [enabled]);

  return enabled ? state : { series: [], loaded: false };
}

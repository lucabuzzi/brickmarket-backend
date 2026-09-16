import { normalizeImageUrl } from '../../api';
import { CATALOG_GAMES } from '../../config/catalogGames';
import { cldImage } from '../landing/landingUtils';

export function contestImage(contest, width) {
  return cldImage(normalizeImageUrl(contest.imageUrl), width);
}

export function gameName(slug) {
  return CATALOG_GAMES.find((g) => g.slug === slug)?.name || slug;
}

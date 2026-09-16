import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatEUR, listingImage } from './landingUtils';

// Enough copies that one half of the track is always wider than the widest viewport,
// so the -50% translate loop never shows a gap even with only a handful of listings.
const MIN_ITEMS_PER_HALF = 14;

function fillTrack(items) {
  if (!items.length) return [];
  const half = [];
  while (half.length < MIN_ITEMS_PER_HALF) half.push(...items);
  return [...half, ...half];
}

export default function LandingTicker({ listings }) {
  const { t, i18n } = useTranslation();
  const track = fillTrack(listings);
  if (!track.length) return null;

  return (
    <section className="lx-bleed relative z-10 -mt-6 overflow-hidden py-6" aria-label={t('landing.ticker.label')}>
      <div className="lx-tape -ml-[5%] w-[110%] -rotate-[1.6deg] bg-[#c6ff3d] py-3 shadow-[0_20px_60px_-20px_rgba(198,255,61,0.45)]">
        <div className="lx-marquee flex w-max items-center">
          {track.map((l, i) => (
            <Link
              key={`${l.id}-${i}`}
              to={`/product/${l.id}`}
              tabIndex={i >= listings.length ? -1 : undefined}
              aria-hidden={i >= listings.length ? 'true' : undefined}
              className="group mr-3 flex shrink-0 items-center gap-2.5 rounded-full bg-[#10140a] py-1 pl-1 pr-4 text-[#e9ffc0] transition-colors hover:bg-black"
            >
              <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[#2a3319]">
                <img src={listingImage(l, 96)} alt="" loading="lazy" className="h-full w-full object-cover" />
              </span>
              <span className="max-w-[180px] truncate text-[13px] font-bold">{l.title}</span>
              <span className="font-mono text-[13px] font-black tabular-nums text-[#c6ff3d]">{formatEUR(l.price, i18n.language)}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

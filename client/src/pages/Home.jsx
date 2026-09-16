import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api';
import LandingHero from '../components/landing/LandingHero';
import LandingTicker from '../components/landing/LandingTicker';
import LandingPillars from '../components/landing/LandingPillars';
import LandingListings from '../components/landing/LandingListings';
import LandingAuctions from '../components/landing/LandingAuctions';
import LandingArena from '../components/landing/LandingArena';
import LandingClosing from '../components/landing/LandingClosing';
import { cldImage, listingImage } from '../components/landing/landingUtils';

const asArray = (result) => (result.status === 'fulfilled' && Array.isArray(result.value) ? result.value : []);

export default function Home() {
  const [listings, setListings] = useState([]);
  const [auctions, setAuctions] = useState([]);
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Each feed fails independently: an outage on one section shouldn't blank the whole page.
    Promise.allSettled([
      apiFetch('/api/listings?is_auction=false'),
      apiFetch('/api/listings?is_auction=true'),
      apiFetch('/api/contest/list'),
    ]).then(([fixedRes, auctionRes, contestRes]) => {
      if (cancelled) return;
      const now = Date.now();
      setListings(asArray(fixedRes));
      setAuctions(
        asArray(auctionRes)
          .filter((a) => a.status === 'active' && a.auction_end && new Date(a.auction_end).getTime() > now)
          .sort((a, b) => new Date(a.auction_end) - new Date(b.auction_end)),
      );
      setContests(
        contestRes.status === 'fulfilled' && Array.isArray(contestRes.value?.contests)
          ? contestRes.value.contests.filter((c) => c.status === 'open' || c.status === 'active')
          : [],
      );
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => ({
    listings: listings.length,
    auctions: auctions.length,
    contests: contests.filter((c) => c.status === 'open').length,
  }), [listings, auctions, contests]);

  const featuredFirst = useMemo(
    () => [...listings].sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || new Date(b.created_at) - new Date(a.created_at)),
    [listings],
  );

  // Hero fan: real items from all three worlds, interleaved so every pillar is represented.
  const stackItems = useMemo(() => {
    const fromListings = featuredFirst.filter((l) => l.images?.length).slice(0, 3).map((l) => ({
      key: `l-${l.id}`, kind: 'listing', title: l.title, value: l.price, image: listingImage(l, 480), href: `/product/${l.id}`,
    }));
    const fromAuctions = auctions.filter((a) => a.images?.length).slice(0, 1).map((a) => ({
      key: `a-${a.id}`, kind: 'auction', title: a.title, value: a.current_bid ?? a.starting_price ?? a.price, image: listingImage(a, 480), href: `/product/${a.id}`,
    }));
    const fromContests = contests.filter((c) => c.status === 'open' && c.imageUrl).slice(0, 2).map((c) => ({
      key: `c-${c.id}`, kind: 'contest', title: c.title, value: c.marketValue, image: cldImage(c.imageUrl, 480), href: '/skill-zone',
    }));

    const pools = [fromListings, fromContests, fromAuctions];
    const mixed = [];
    while (mixed.length < 5 && pools.some((p) => p.length)) {
      pools.forEach((p) => { if (p.length && mixed.length < 5) mixed.push(p.shift()); });
    }
    return mixed;
  }, [featuredFirst, auctions, contests]);

  const pillarImages = useMemo(() => {
    const listingImg = featuredFirst.find((l) => l.images?.length);
    const legoImg = featuredFirst.find((l) => l.product_type === 'lego' && l.images?.length && l.id !== listingImg?.id);
    const auctionImg = auctions.find((a) => a.images?.length) || legoImg;
    const contestImg = contests.find((c) => c.imageUrl);
    return {
      listings: listingImg ? listingImage(listingImg, 900) : '',
      auctions: auctionImg ? listingImage(auctionImg, 900) : '',
      arena: contestImg ? cldImage(contestImg.imageUrl, 900) : '',
    };
  }, [featuredFirst, auctions, contests]);

  return (
    <div className="lx-page">
      <LandingHero stackItems={stackItems} stats={stats} statsLoading={loading} />
      <LandingTicker listings={featuredFirst.slice(0, 16)} />
      <LandingPillars images={pillarImages} stats={stats} statsLoading={loading} />
      <LandingListings listings={listings} loading={loading} />
      <LandingAuctions auctions={auctions} loading={loading} />
      <LandingArena contests={contests} loading={loading} />
      <LandingClosing />
    </div>
  );
}

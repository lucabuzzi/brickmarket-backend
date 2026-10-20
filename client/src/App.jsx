import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import Home from './pages/Home';
import LocaleFrame from './routing/LocaleFrame';
import { URL_LOCALES, DEFAULT_URL_LOCALE, resolveLocalizedPath } from './routing/localizedPaths';

// Every other route is code-split: without this the whole app (including admin, wallet and
// TCG catalog pages most visitors never open) shipped as a single ~1.3MB JS bundle. Home stays
// a static import since it's the most common entry point and shouldn't wait on a chunk fetch.
const NotFound = lazy(() => import('./pages/NotFound'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ListingDetail = lazy(() => import('./pages/ListingDetail'));
const Account = lazy(() => import('./pages/Account'));
const Sell = lazy(() => import('./pages/Sell'));
const CreateAuction = lazy(() => import('./pages/CreateAuction'));
const MyListings = lazy(() => import('./pages/MyListings'));
const Notifications = lazy(() => import('./pages/Notifications'));
const SellerShipments = lazy(() => import('./pages/SellerShipments'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const Cart = lazy(() => import('./pages/Cart'));
const Profile = lazy(() => import('./pages/Profile'));
const FAQ = lazy(() => import('./pages/FAQ'));
const Help = lazy(() => import('./pages/Help'));
const SearchResults = lazy(() => import('./pages/SearchResults'));
const UserSearch = lazy(() => import('./pages/UserSearch'));
const LegalRules = lazy(() => import('./pages/LegalRules'));
const PolicyPage = lazy(() => import('./pages/PolicyPage'));
const PublicProfile = lazy(() => import('./pages/PublicProfile'));
const CategoryPage = lazy(() => import('./pages/CategoryPage'));
const MarketHub = lazy(() => import('./pages/MarketHub'));
const MarketCardsHub = lazy(() => import('./pages/MarketCardsHub'));
const MarketCategory = lazy(() => import('./pages/MarketCategory'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminArchive = lazy(() => import('./pages/AdminArchive'));
const AdminWalletTransactions = lazy(() => import('./pages/AdminWalletTransactions'));
const AdminCreditConfig = lazy(() => import('./pages/AdminCreditConfig'));
const AdminFeaturedPricing = lazy(() => import('./pages/AdminFeaturedPricing'));
const AdminDisputes = lazy(() => import('./pages/AdminDisputes'));
const AdminFlaggedGrants = lazy(() => import('./pages/AdminFlaggedGrants'));
const AdminPayouts = lazy(() => import('./pages/AdminPayouts'));
const AdminUsersList = lazy(() => import('./pages/AdminUsersList'));
const AdminListings = lazy(() => import('./pages/AdminListings'));
const AdminUserDetail = lazy(() => import('./pages/AdminUserDetail'));
const AdminInteractions = lazy(() => import('./pages/AdminInteractions'));
const AdminAnalytics = lazy(() => import('./pages/AdminAnalytics'));
const AdminAnalyticsCalendar = lazy(() => import('./pages/AdminAnalyticsCalendar'));
const CatalogPage = lazy(() => import('./pages/CatalogPage'));
const CatalogIndex = lazy(() => import('./pages/CatalogIndex'));
const CatalogSearchResults = lazy(() => import('./pages/CatalogSearchResults'));
const CatalogHub = lazy(() => import('./pages/CatalogHub'));
const CatalogComingSoon = lazy(() => import('./pages/CatalogComingSoon'));
const TcgCatalogIndex = lazy(() => import('./pages/TcgCatalogIndex'));
const TcgSearchResults = lazy(() => import('./pages/TcgSearchResults'));
const TcgCardPage = lazy(() => import('./pages/TcgCardPage'));
const Archive = lazy(() => import('./pages/Archive'));
const SkillZone = lazy(() => import('./pages/SkillZone'));
const GamePage = lazy(() => import('./game/GamePage'));
const GameInventory = lazy(() => import('./game/InventoryPage'));
const WalletInfo = lazy(() => import('./pages/WalletInfo'));
const StripeOnboardingStatus = lazy(() => import('./pages/StripeOnboardingStatus'));
const HowItWorks = lazy(() => import('./pages/HowItWorks'));

function RouteLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--muted)' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// The structural/marketing pages that get a real, translated URL under /it and /en (see
// client/src/config/localizedRoutes.json for the Italian->English path map this is keyed against).
// `it` is the canonical path exactly as it was declared before this file had locale prefixes — every
// other route in this file (auth pages, product/:id, user/:username, catalog item detail, admin/*) is
// intentionally NOT here and keeps its single, unprefixed URL further down, unchanged.
const STRUCTURAL_ROUTES = [
  { it: 'annunci', element: <MarketHub modeKey="listings" /> },
  { it: 'annunci/lego', element: <MarketCategory modeKey="listings" productType="lego" /> },
  { it: 'annunci/funko', element: <MarketCategory modeKey="listings" productType="funko" /> },
  { it: 'annunci/carte-collezionabili', element: <MarketCardsHub modeKey="listings" /> },
  { it: 'annunci/carte-collezionabili/pokemon', element: <MarketCategory modeKey="listings" productType="tcg" game="pokemon" /> },
  { it: 'annunci/carte-collezionabili/pokemon/:espansione', element: <MarketCategory modeKey="listings" productType="tcg" game="pokemon" bySet /> },
  { it: 'annunci/carte-collezionabili/magic', element: <MarketCategory modeKey="listings" productType="tcg" game="magic" /> },
  { it: 'annunci/carte-collezionabili/magic/:espansione', element: <MarketCategory modeKey="listings" productType="tcg" game="magic" bySet /> },
  { it: 'annunci/carte-collezionabili/lorcana', element: <MarketCategory modeKey="listings" productType="tcg" game="lorcana" /> },
  { it: 'annunci/carte-collezionabili/lorcana/:espansione', element: <MarketCategory modeKey="listings" productType="tcg" game="lorcana" bySet /> },
  { it: 'annunci/carte-collezionabili/yugioh', element: <MarketCategory modeKey="listings" productType="tcg" game="yugioh" /> },
  { it: 'annunci/carte-collezionabili/yugioh/:espansione', element: <MarketCategory modeKey="listings" productType="tcg" game="yugioh" bySet /> },
  { it: 'annunci/carte-collezionabili/onepiece', element: <MarketCategory modeKey="listings" productType="tcg" game="onepiece" /> },
  { it: 'annunci/carte-collezionabili/onepiece/:espansione', element: <MarketCategory modeKey="listings" productType="tcg" game="onepiece" bySet /> },
  { it: 'annunci/carte-collezionabili/dragonball', element: <MarketCategory modeKey="listings" productType="tcg" game="dragonball" /> },
  { it: 'annunci/carte-collezionabili/:slug', redirectTo: 'annunci/carte-collezionabili' },
  { it: 'aste', element: <MarketHub modeKey="auctions" /> },
  { it: 'aste/lego', element: <MarketCategory modeKey="auctions" productType="lego" /> },
  { it: 'aste/funko', element: <MarketCategory modeKey="auctions" productType="funko" /> },
  { it: 'aste/carte-collezionabili', element: <MarketCardsHub modeKey="auctions" /> },
  { it: 'aste/carte-collezionabili/pokemon', element: <MarketCategory modeKey="auctions" productType="tcg" game="pokemon" /> },
  { it: 'aste/carte-collezionabili/pokemon/:espansione', element: <MarketCategory modeKey="auctions" productType="tcg" game="pokemon" bySet /> },
  { it: 'aste/carte-collezionabili/magic', element: <MarketCategory modeKey="auctions" productType="tcg" game="magic" /> },
  { it: 'aste/carte-collezionabili/magic/:espansione', element: <MarketCategory modeKey="auctions" productType="tcg" game="magic" bySet /> },
  { it: 'aste/carte-collezionabili/lorcana', element: <MarketCategory modeKey="auctions" productType="tcg" game="lorcana" /> },
  { it: 'aste/carte-collezionabili/lorcana/:espansione', element: <MarketCategory modeKey="auctions" productType="tcg" game="lorcana" bySet /> },
  { it: 'aste/carte-collezionabili/yugioh', element: <MarketCategory modeKey="auctions" productType="tcg" game="yugioh" /> },
  { it: 'aste/carte-collezionabili/yugioh/:espansione', element: <MarketCategory modeKey="auctions" productType="tcg" game="yugioh" bySet /> },
  { it: 'aste/carte-collezionabili/onepiece', element: <MarketCategory modeKey="auctions" productType="tcg" game="onepiece" /> },
  { it: 'aste/carte-collezionabili/onepiece/:espansione', element: <MarketCategory modeKey="auctions" productType="tcg" game="onepiece" bySet /> },
  { it: 'aste/carte-collezionabili/dragonball', element: <MarketCategory modeKey="auctions" productType="tcg" game="dragonball" /> },
  { it: 'aste/carte-collezionabili/:slug', redirectTo: 'aste/carte-collezionabili' },
  { it: 'come-funziona', element: <HowItWorks /> },
  { it: 'skill-zone', element: <SkillZone /> },
  { it: 'crediti', element: <WalletInfo /> },
  { it: 'faq', element: <FAQ /> },
  { it: 'help', element: <Help /> },
  { it: 'catalog', element: <CatalogHub /> },
  { it: 'catalog/lego', element: <CatalogIndex /> },
  { it: 'catalog/lego/search', element: <CatalogSearchResults /> },
  { it: 'catalog/magic', element: <TcgCatalogIndex gameSlug="magic" /> },
  { it: 'catalog/magic/search', element: <TcgSearchResults gameSlug="magic" /> },
  { it: 'catalog/yugioh', element: <TcgCatalogIndex gameSlug="yugioh" /> },
  { it: 'catalog/yugioh/search', element: <TcgSearchResults gameSlug="yugioh" /> },
  { it: 'catalog/lorcana', element: <TcgCatalogIndex gameSlug="lorcana" /> },
  { it: 'catalog/lorcana/search', element: <TcgSearchResults gameSlug="lorcana" /> },
  { it: 'catalog/pokemon', element: <TcgCatalogIndex gameSlug="pokemon" /> },
  { it: 'catalog/pokemon/search', element: <TcgSearchResults gameSlug="pokemon" /> },
  { it: 'catalog/onepiece', element: <TcgCatalogIndex gameSlug="onepiece" /> },
  { it: 'catalog/onepiece/search', element: <TcgSearchResults gameSlug="onepiece" /> },
  { it: 'catalog/dragonball', element: <TcgCatalogIndex gameSlug="dragonball" /> },
  { it: 'catalog/dragonball/search', element: <TcgSearchResults gameSlug="dragonball" /> },
  { it: 'catalog/funko', element: <TcgCatalogIndex gameSlug="funko" /> },
  { it: 'catalog/funko/search', element: <TcgSearchResults gameSlug="funko" /> },
  { it: 'ricerca-utente', element: <UserSearch /> },
  { it: 'norme-legali', element: <LegalRules /> },
  { it: 'privacy', element: <PolicyPage ns="privacy" /> },
  { it: 'cookie-policy', element: <PolicyPage ns="cookie_policy" /> },
  { it: 'accessibilita', element: <PolicyPage ns="accessibility" /> },
  { it: 'search-results', element: <SearchResults /> },
];

export default function App() {
  const location = useLocation();
  const { i18n } = useTranslation();
  // These two routes are only ever hit unprefixed (old bookmarks, no /it or /en in the URL), so
  // there's no URL locale to read from the path itself — fall back to the active UI language.
  const legacyCreditiLocale = URL_LOCALES.includes(i18n.language) ? i18n.language : DEFAULT_URL_LOCALE;
  const legacyCreditiTarget = resolveLocalizedPath('/crediti', legacyCreditiLocale);

  return (
    <>
      <ScrollToTop />
      <AnimatePresence mode="wait">
        <Suspense fallback={<RouteLoader />}>
        <Routes location={location} key={location.pathname}>
          {/* "CardBrix the game!": its own full-screen shell, deliberately outside the site Layout. */}
          <Route path="game" element={<GamePage />} />
          <Route path="game/inventario/:username" element={<GameInventory />} />
          <Route element={<Layout />}>
          <Route index element={<Home />} />

          {URL_LOCALES.map((locale) => (
            <Route key={locale} path={locale} element={<LocaleFrame locale={locale} />}>
              <Route index element={<Home />} />
              {STRUCTURAL_ROUTES.map(({ it, element, redirectTo }) => {
                const localizedPath = resolveLocalizedPath(`/${it}`, locale).replace(`/${locale}/`, '');
                const resolvedElement = redirectTo
                  ? <Navigate to={resolveLocalizedPath(`/${redirectTo}`, locale)} replace />
                  : element;
                return <Route key={it} path={localizedPath} element={resolvedElement} />;
              })}
            </Route>
          ))}

          <Route path="crediti/acquista" element={<Navigate to={legacyCreditiTarget} replace />} />
          <Route path="crediti/converti" element={<Navigate to={legacyCreditiTarget} replace />} />
          <Route path="seller/onboarding-complete" element={<StripeOnboardingStatus outcome="complete" />} />
          <Route path="seller/onboarding-retry" element={<StripeOnboardingStatus outcome="retry" />} />
          <Route path="category/:slug" element={<CategoryPage />} />
          <Route path="archive" element={<Archive />} />
          <Route path="catalog/lego/:setNum" element={<CatalogPage />} />
          <Route path="catalog/magic/:cardId" element={<TcgCardPage gameSlug="magic" />} />
          <Route path="catalog/yugioh/:cardId" element={<TcgCardPage gameSlug="yugioh" />} />
          <Route path="catalog/lorcana/:cardId" element={<TcgCardPage gameSlug="lorcana" />} />
          <Route path="catalog/pokemon/:cardId" element={<TcgCardPage gameSlug="pokemon" />} />
          <Route path="catalog/onepiece/:cardId" element={<TcgCardPage gameSlug="onepiece" />} />
          <Route path="catalog/dragonball/:cardId" element={<TcgCardPage gameSlug="dragonball" />} />
          <Route path="catalog/funko/:cardId" element={<TcgCardPage gameSlug="funko" />} />
          <Route path="catalog/:slug" element={<CatalogComingSoon />} />
          <Route path="user/:username" element={<PublicProfile />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="reset-password" element={<ResetPassword />} />
          <Route path="verifica-email" element={<VerifyEmail />} />
          <Route path="product/:id" element={<ListingDetail />} />
          <Route path="account" element={<Account />} />
          <Route path="admin" element={<ProtectedRoute adminOnly={true}><AdminDashboard /></ProtectedRoute>} />
          <Route path="admin/archive" element={<ProtectedRoute adminOnly={true}><AdminArchive /></ProtectedRoute>} />
          <Route path="admin/wallet-transactions" element={<ProtectedRoute adminOnly={true}><AdminWalletTransactions /></ProtectedRoute>} />
          <Route path="admin/credit-config" element={<ProtectedRoute adminOnly={true}><AdminCreditConfig /></ProtectedRoute>} />
          <Route path="admin/featured-pricing" element={<ProtectedRoute adminOnly={true}><AdminFeaturedPricing /></ProtectedRoute>} />
          <Route path="admin/disputes" element={<ProtectedRoute adminOnly={true}><AdminDisputes /></ProtectedRoute>} />
          <Route path="admin/flagged-grants" element={<ProtectedRoute adminOnly={true}><AdminFlaggedGrants /></ProtectedRoute>} />
          <Route path="admin/payouts" element={<ProtectedRoute adminOnly={true}><AdminPayouts /></ProtectedRoute>} />
          <Route path="admin/users" element={<ProtectedRoute adminOnly={true}><AdminUsersList /></ProtectedRoute>} />
          <Route path="admin/listings" element={<ProtectedRoute adminOnly={true}><AdminListings /></ProtectedRoute>} />
          <Route path="admin/users/:id" element={<ProtectedRoute adminOnly={true}><AdminUserDetail /></ProtectedRoute>} />
          <Route path="admin/interactions" element={<ProtectedRoute adminOnly={true}><AdminInteractions /></ProtectedRoute>} />
          <Route path="admin/analytics" element={<ProtectedRoute adminOnly={true}><AdminAnalytics /></ProtectedRoute>} />
          <Route path="admin/analytics/calendar" element={<ProtectedRoute adminOnly={true}><AdminAnalyticsCalendar /></ProtectedRoute>} />
          <Route path="profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="cart" element={<Cart />} />
          <Route
            path="sell"
            element={
              <ProtectedRoute>
                <Sell />
              </ProtectedRoute>
            }
          />
          <Route
            path="sell/cards"
            element={
              <ProtectedRoute>
                <Sell cardsMode />
              </ProtectedRoute>
            }
          />
          <Route
            path="create-auction"
            element={
              <ProtectedRoute>
                <CreateAuction />
              </ProtectedRoute>
            }
          />
          <Route
            path="my-listings"
            element={
              <ProtectedRoute>
                <MyListings />
              </ProtectedRoute>
            }
          />
          <Route
            path="notifications"
            element={
              <ProtectedRoute>
                <Notifications />
              </ProtectedRoute>
            }
          />
          <Route
            path="my-shipments"
            element={
              <ProtectedRoute>
                <SellerShipments />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
        </Suspense>
      </AnimatePresence>
    </>
  );
}

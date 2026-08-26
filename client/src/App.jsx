import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import Home from './pages/Home';

// Every other route is code-split: without this the whole app (including admin, wallet and
// TCG catalog pages most visitors never open) shipped as a single ~1.3MB JS bundle. Home stays
// a static import since it's the most common entry point and shouldn't wait on a chunk fetch.
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ListingDetail = lazy(() => import('./pages/ListingDetail'));
const Account = lazy(() => import('./pages/Account'));
const Sell = lazy(() => import('./pages/Sell'));
const CreateAuction = lazy(() => import('./pages/CreateAuction'));
const MyListings = lazy(() => import('./pages/MyListings'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Cart = lazy(() => import('./pages/Cart'));
const Profile = lazy(() => import('./pages/Profile'));
const FAQ = lazy(() => import('./pages/FAQ'));
const Help = lazy(() => import('./pages/Help'));
const SearchResults = lazy(() => import('./pages/SearchResults'));
const UserSearch = lazy(() => import('./pages/UserSearch'));
const LegalRules = lazy(() => import('./pages/LegalRules'));
const PublicProfile = lazy(() => import('./pages/PublicProfile'));
const CategoryPage = lazy(() => import('./pages/CategoryPage'));
const AnnunciHub = lazy(() => import('./pages/AnnunciHub'));
const AnnunciCardsHub = lazy(() => import('./pages/AnnunciCardsHub'));
const AsteHub = lazy(() => import('./pages/AsteHub'));
const AsteCardsHub = lazy(() => import('./pages/AsteCardsHub'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminArchive = lazy(() => import('./pages/AdminArchive'));
const AdminWalletTransactions = lazy(() => import('./pages/AdminWalletTransactions'));
const AdminPayouts = lazy(() => import('./pages/AdminPayouts'));
const AdminUsersList = lazy(() => import('./pages/AdminUsersList'));
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
const Annunci = lazy(() => import('./pages/Annunci'));
const Aste = lazy(() => import('./pages/Aste'));
const SkillZone = lazy(() => import('./pages/SkillZone'));
const WalletInfo = lazy(() => import('./pages/WalletInfo'));
const WalletPurchase = lazy(() => import('./pages/WalletPurchase'));
const WalletConvert = lazy(() => import('./pages/WalletConvert'));
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

export default function App() {
  const location = useLocation();

  return (
    <>
      <ScrollToTop />
      <AnimatePresence mode="wait">
        <Suspense fallback={<RouteLoader />}>
        <Routes location={location} key={location.pathname}>
          <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="annunci" element={<AnnunciHub />} />
          <Route path="annunci/lego" element={<Annunci productType="lego" />} />
          <Route path="annunci/funko" element={<Annunci productType="funko" />} />
          <Route path="annunci/carte-collezionabili" element={<AnnunciCardsHub />} />
          <Route path="annunci/carte-collezionabili/pokemon" element={<Annunci productType="tcg" game="pokemon" />} />
          <Route path="annunci/carte-collezionabili/magic" element={<Annunci productType="tcg" game="magic" />} />
          <Route path="annunci/carte-collezionabili/lorcana" element={<Annunci productType="tcg" game="lorcana" />} />
          <Route path="annunci/carte-collezionabili/yugioh" element={<Annunci productType="tcg" game="yugioh" />} />
          <Route path="annunci/carte-collezionabili/onepiece" element={<Annunci productType="tcg" game="onepiece" />} />
          <Route path="annunci/carte-collezionabili/dragonball" element={<Annunci productType="tcg" game="dragonball" />} />
          <Route path="annunci/carte-collezionabili/:slug" element={<Navigate to="/annunci/carte-collezionabili" replace />} />
          <Route path="aste" element={<AsteHub />} />
          <Route path="aste/lego" element={<Aste productType="lego" />} />
          <Route path="aste/funko" element={<Aste productType="funko" />} />
          <Route path="aste/carte-collezionabili" element={<AsteCardsHub />} />
          <Route path="aste/carte-collezionabili/pokemon" element={<Aste productType="tcg" game="pokemon" />} />
          <Route path="aste/carte-collezionabili/magic" element={<Aste productType="tcg" game="magic" />} />
          <Route path="aste/carte-collezionabili/lorcana" element={<Aste productType="tcg" game="lorcana" />} />
          <Route path="aste/carte-collezionabili/yugioh" element={<Aste productType="tcg" game="yugioh" />} />
          <Route path="aste/carte-collezionabili/onepiece" element={<Aste productType="tcg" game="onepiece" />} />
          <Route path="aste/carte-collezionabili/dragonball" element={<Aste productType="tcg" game="dragonball" />} />
          <Route path="aste/carte-collezionabili/:slug" element={<Navigate to="/aste/carte-collezionabili" replace />} />
          <Route path="come-funziona" element={<HowItWorks />} />
          <Route path="skill-zone" element={<SkillZone />} />
          <Route path="crediti" element={<WalletInfo />} />
          <Route
            path="crediti/acquista"
            element={
              <ProtectedRoute>
                <WalletPurchase />
              </ProtectedRoute>
            }
          />
          <Route
            path="crediti/converti"
            element={
              <ProtectedRoute>
                <WalletConvert />
              </ProtectedRoute>
            }
          />
          <Route path="seller/onboarding-complete" element={<StripeOnboardingStatus outcome="complete" />} />
          <Route path="seller/onboarding-retry" element={<StripeOnboardingStatus outcome="retry" />} />
          <Route path="category/:slug" element={<CategoryPage />} />
          <Route path="faq" element={<FAQ />} />
          <Route path="help" element={<Help />} />
          <Route path="archive" element={<Archive />} />
          <Route path="catalog" element={<CatalogHub />} />
          <Route path="catalog/lego" element={<CatalogIndex />} />
          <Route path="catalog/lego/search" element={<CatalogSearchResults />} />
          <Route path="catalog/lego/:setNum" element={<CatalogPage />} />
          <Route path="catalog/magic" element={<TcgCatalogIndex gameSlug="magic" />} />
          <Route path="catalog/magic/search" element={<TcgSearchResults gameSlug="magic" />} />
          <Route path="catalog/magic/:cardId" element={<TcgCardPage gameSlug="magic" />} />
          <Route path="catalog/yugioh" element={<TcgCatalogIndex gameSlug="yugioh" />} />
          <Route path="catalog/yugioh/search" element={<TcgSearchResults gameSlug="yugioh" />} />
          <Route path="catalog/yugioh/:cardId" element={<TcgCardPage gameSlug="yugioh" />} />
          <Route path="catalog/lorcana" element={<TcgCatalogIndex gameSlug="lorcana" />} />
          <Route path="catalog/lorcana/search" element={<TcgSearchResults gameSlug="lorcana" />} />
          <Route path="catalog/lorcana/:cardId" element={<TcgCardPage gameSlug="lorcana" />} />
          <Route path="catalog/pokemon" element={<TcgCatalogIndex gameSlug="pokemon" />} />
          <Route path="catalog/pokemon/search" element={<TcgSearchResults gameSlug="pokemon" />} />
          <Route path="catalog/pokemon/:cardId" element={<TcgCardPage gameSlug="pokemon" />} />
          <Route path="catalog/onepiece" element={<TcgCatalogIndex gameSlug="onepiece" />} />
          <Route path="catalog/onepiece/search" element={<TcgSearchResults gameSlug="onepiece" />} />
          <Route path="catalog/onepiece/:cardId" element={<TcgCardPage gameSlug="onepiece" />} />
          <Route path="catalog/dragonball" element={<TcgCatalogIndex gameSlug="dragonball" />} />
          <Route path="catalog/dragonball/search" element={<TcgSearchResults gameSlug="dragonball" />} />
          <Route path="catalog/dragonball/:cardId" element={<TcgCardPage gameSlug="dragonball" />} />
          <Route path="catalog/funko" element={<TcgCatalogIndex gameSlug="funko" />} />
          <Route path="catalog/funko/search" element={<TcgSearchResults gameSlug="funko" />} />
          <Route path="catalog/funko/:cardId" element={<TcgCardPage gameSlug="funko" />} />
          <Route path="catalog/:slug" element={<CatalogComingSoon />} />
          <Route path="ricerca-utente" element={<UserSearch />} />
          <Route path="user/:username" element={<PublicProfile />} />
          <Route path="norme-legali" element={<LegalRules />} />
          <Route path="search-results" element={<SearchResults />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="reset-password" element={<ResetPassword />} />
          <Route path="product/:id" element={<ListingDetail />} />
          <Route path="account" element={<Account />} />
          <Route path="admin" element={<ProtectedRoute adminOnly={true}><AdminDashboard /></ProtectedRoute>} />
          <Route path="admin/archive" element={<ProtectedRoute adminOnly={true}><AdminArchive /></ProtectedRoute>} />
          <Route path="admin/wallet-transactions" element={<ProtectedRoute adminOnly={true}><AdminWalletTransactions /></ProtectedRoute>} />
          <Route path="admin/payouts" element={<ProtectedRoute adminOnly={true}><AdminPayouts /></ProtectedRoute>} />
          <Route path="admin/users" element={<ProtectedRoute adminOnly={true}><AdminUsersList /></ProtectedRoute>} />
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
          </Route>
        </Routes>
        </Suspense>
      </AnimatePresence>
    </>
  );
}

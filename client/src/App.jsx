import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ListingDetail from './pages/ListingDetail';
import Account from './pages/Account';
import Sell from './pages/Sell';
import CreateAuction from './pages/CreateAuction';
import MyListings from './pages/MyListings';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Cart from './pages/Cart';
import Profile from './pages/Profile';
import FAQ from './pages/FAQ';
import Help from './pages/Help';
import SearchResults from './pages/SearchResults';
import UserSearch from './pages/UserSearch';
import LegalRules from './pages/LegalRules';
import PublicProfile from './pages/PublicProfile';
import CategoryPage from './pages/CategoryPage';
import AnnunciHub from './pages/AnnunciHub';
import AnnunciCardsHub from './pages/AnnunciCardsHub';
import AsteHub from './pages/AsteHub';
import AsteCardsHub from './pages/AsteCardsHub';
import AdminDashboard from './pages/AdminDashboard';
import AdminArchive from './pages/AdminArchive';
import AdminWalletTransactions from './pages/AdminWalletTransactions';
import AdminPayouts from './pages/AdminPayouts';
import AdminUsersList from './pages/AdminUsersList';
import AdminInteractions from './pages/AdminInteractions';
import AdminAnalytics from './pages/AdminAnalytics';
import AdminAnalyticsCalendar from './pages/AdminAnalyticsCalendar';
import CatalogPage from './pages/CatalogPage';
import CatalogIndex from './pages/CatalogIndex';
import CatalogSearchResults from './pages/CatalogSearchResults';
import CatalogHub from './pages/CatalogHub';
import CatalogComingSoon from './pages/CatalogComingSoon';
import TcgCatalogIndex from './pages/TcgCatalogIndex';
import TcgSearchResults from './pages/TcgSearchResults';
import TcgCardPage from './pages/TcgCardPage';
import Archive from './pages/Archive';
import Annunci from './pages/Annunci';
import Aste from './pages/Aste';
import SkillZone from './pages/SkillZone';
import WalletInfo from './pages/WalletInfo';
import WalletPurchase from './pages/WalletPurchase';
import WalletConvert from './pages/WalletConvert';
import StripeOnboardingStatus from './pages/StripeOnboardingStatus';
import HowItWorks from './pages/HowItWorks';

export default function App() {
  const location = useLocation();

  return (
    <>
      <ScrollToTop />
      <AnimatePresence mode="wait">
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
      </AnimatePresence>
    </>
  );
}

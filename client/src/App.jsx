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
import SearchResults from './pages/SearchResults';
import UserSearch from './pages/UserSearch';
import LegalRules from './pages/LegalRules';
import PublicProfile from './pages/PublicProfile';
import CategoryPage from './pages/CategoryPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminArchive from './pages/AdminArchive';
import AdminInteractions from './pages/AdminInteractions';
import CatalogPage from './pages/CatalogPage';
import CatalogIndex from './pages/CatalogIndex';
import CatalogSearchResults from './pages/CatalogSearchResults';
import Archive from './pages/Archive';
import Annunci from './pages/Annunci';
import Aste from './pages/Aste';

export default function App() {
  const location = useLocation();

  return (
    <>
      <ScrollToTop />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="annunci" element={<Annunci />} />
          <Route path="aste" element={<Aste />} />
          <Route path="category/:slug" element={<CategoryPage />} />
          <Route path="faq" element={<FAQ />} />
          <Route path="archive" element={<Archive />} />
          <Route path="catalog" element={<CatalogIndex />} />
          <Route path="catalog/search" element={<CatalogSearchResults />} />
          <Route path="catalog/:setNum" element={<CatalogPage />} />
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
          <Route path="admin/interactions" element={<ProtectedRoute adminOnly={true}><AdminInteractions /></ProtectedRoute>} />
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

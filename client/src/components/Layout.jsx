import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden />
          BrickMarket
        </Link>
        <nav className="nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            Home
          </NavLink>
          {user && (
            <NavLink to="/account" className={({ isActive }) => (isActive ? 'active' : '')}>
              Account
            </NavLink>
          )}
          {!user && (
            <>
              <NavLink to="/login">Accedi</NavLink>
              <NavLink to="/register" className="btn btn--small btn--primary">
                Registrati
              </NavLink>
            </>
          )}
          {user && (
            <button type="button" className="btn btn--ghost btn--small" onClick={logout}>
              Esci
            </button>
          )}
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
      <footer className="footer">
        <p>BrickMarket — demo locale · API su porta 3000</p>
      </footer>
    </div>
  );
}

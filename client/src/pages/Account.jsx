import { useAuth } from '../auth/AuthContext';
import { Link, Navigate } from 'react-router-dom';

export default function Account() {
  const { user, loading } = useAuth();

  if (loading) return <p className="muted">Caricamento profilo…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: { pathname: '/account' } }} />;

  return (
    <div className="page narrow">
      <h1>Ciao, {user.username}</h1>
      <dl className="facts">
        <div>
          <dt>Email</dt>
          <dd>{user.email}</dd>
        </div>
        {user.full_name && (
          <div>
            <dt>Nome</dt>
            <dd>{user.full_name}</dd>
          </div>
        )}
        <div>
          <dt>Ruolo</dt>
          <dd>{user.role}</dd>
        </div>
        {user.city && (
          <div>
            <dt>Città</dt>
            <dd>{user.city}</dd>
          </div>
        )}
      </dl>
      <p className="muted">
        <Link to="/">← Torna agli annunci</Link>
      </p>
    </div>
  );
}

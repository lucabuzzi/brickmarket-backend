import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const [email, setEmail] = useState('seller@demo.brickmarket');
  const [password, setPassword] = useState('Demo1234!');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Accesso non riuscito');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page auth-page narrow">
      <h1>Accedi</h1>
      <p className="muted">
        Account demo: <strong>seller@demo.brickmarket</strong> / <strong>Demo1234!</strong>
      </p>
      <form className="form" onSubmit={onSubmit}>
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="error-banner">{error}</p>}
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? 'Accesso…' : 'Entra'}
        </button>
      </form>
      <p className="muted">
        Non hai un account? <Link to="/register">Registrati</Link>
      </p>
    </div>
  );
}

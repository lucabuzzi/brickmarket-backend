import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register({
        username: username.trim(),
        email: email.trim(),
        password,
        fullName: fullName.trim() || undefined,
        role: 'buyer',
      });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Registrazione non riuscita');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page auth-page narrow">
      <h1>Crea un account</h1>
      <form className="form" onSubmit={onSubmit}>
        <label>
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            minLength={3}
            required
          />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Nome (opzionale)
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </label>
        {error && <p className="error-banner">{error}</p>}
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? 'Creazione…' : 'Registrati'}
        </button>
      </form>
      <p className="muted">
        Hai già un account? <Link to="/login">Accedi</Link>
      </p>
    </div>
  );
}

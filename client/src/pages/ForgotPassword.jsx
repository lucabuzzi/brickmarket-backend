import { useState } from 'react';
import { apiUrl } from '../api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null); // 'idle', 'loading', 'success', 'error'
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('');

    try {
      const response = await fetch(apiUrl('/api/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Si è verificato un errore');
      }

      setStatus('success');
      setMessage(data.message || 'Email di recupero inviata.');
    } catch (err) {
      setStatus('error');
      setMessage(err.message);
    }
  };

  return (
    <div className="page auth-page narrow" style={{ maxWidth: '400px', margin: '4rem auto' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '1.5rem', fontSize: '1.6rem' }}>Hai dimenticato la password?</h1>
      <p style={{ textAlign: 'center', color: '#cbd5e1', marginBottom: '2rem', fontSize: '0.9rem' }}>
        Inserisci il tuo indirizzo email qui sotto. Ti invieremo un link sicuro per reimpostare la tua password.
      </p>

      {status === 'success' ? (
        <div style={{ backgroundColor: '#064e3b', color: '#34d399', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
          <strong>Operazione riuscita!</strong><br />
          {message}
        </div>
      ) : (
        <form className="form" onSubmit={handleSubmit}>
          <label>
            Indirizzo email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="tu@esempio.com"
              autoComplete="email"
            />
          </label>

          {status === 'error' && (
            <div style={{ color: '#ef4444', backgroundColor: '#450a0a', padding: '0.75rem', borderRadius: '4px', fontSize: '0.9rem', marginBottom: '1rem' }}>
              {message}
            </div>
          )}

          <button 
            type="submit" 
            className="btn btn--primary" 
            disabled={status === 'loading' || !email}
            style={{ width: '100%', padding: '0.75rem', marginTop: '1rem' }}
          >
            {status === 'loading' ? 'CARICAMENTO...' : 'INVIARE EMAIL'}
          </button>
        </form>
      )}

      <div style={{ marginTop: '2rem', textAlign: 'center', borderTop: '1px solid #1e293b', paddingTop: '1.5rem' }}>
        <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
          Hai bisogno di aiuto? Contattaci a <a href="mailto:support@brickmarket.com" style={{ color: '#38bdf8' }}>support@brickmarket.com</a>
        </p>
      </div>
    </div>
  );
}

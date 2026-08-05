import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function LegalRules() {
  const { t } = useTranslation();

  const articles = [
    'art1', 'art2', 'art3', 'art4', 'art5', 'art6', 'art7', 'art8',
    'art10', 'art11', 'art12', 'art13',
  ];

  return (
    <div className="page" style={{ maxWidth: '850px', margin: '0 auto', padding: '2rem 1.5rem', color: 'var(--text)' }}>
      <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#fff' }}>
          {t('legal.title')}
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '1.1rem' }}>
          {t('legal.subtitle')}
        </p>
      </header>

      <section style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '16px', padding: '2.5rem', lineHeight: '1.6' }}>
        {articles.map((art) => (
          <div key={art} style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', color: '#fff', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              {t(`legal.${art}_title`)}
            </h2>
            <p style={{ color: 'var(--muted)', margin: 0, whiteSpace: 'pre-line' }}>
              {t(`legal.${art}_body`)}
            </p>
          </div>
        ))}
      </section>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4rem' }}>
        <Link
          to="/"
          className="btn btn--primary"
          style={{
            padding: '0.8rem 2.5rem',
            fontSize: '1.1rem',
            fontWeight: 'bold',
            borderRadius: '12px',
            textDecoration: 'none',
            display: 'inline-block',
            boxShadow: '0 4px 12px rgba(217, 58, 58, 0.3)'
          }}
        >
          {t('ui.back_to_home')}
        </Link>
      </div>
    </div>
  );
}

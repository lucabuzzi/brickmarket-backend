import { Link } from 'react-router-dom';

export default function LegalRules() {
  return (
    <div className="page" style={{ maxWidth: '850px', margin: '0 auto', padding: '2rem 1.5rem', color: 'var(--text)' }}>
      <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#fff' }}>
          Norme Legali
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '1.1rem' }}>
          Regolamento di utilizzo della piattaforma Marketplace LEGO
        </p>
      </header>

      <section style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '16px', padding: '2.5rem', lineHeight: '1.6' }}>
        
        <div style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', color: '#fff', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            Art. 1 – Oggetto
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: 'var(--muted)' }}>
            <li style={{ marginBottom: '0.75rem' }}>1.1 Il presente regolamento disciplina le condizioni di accesso e utilizzo della piattaforma online di marketplace gestita da [Nome Azienda / Titolare].</li>
            <li style={{ marginBottom: '0.75rem' }}>1.2 La Piattaforma consente a soggetti terzi di porre in vendita e/o acquistare prodotti LEGO, nuovi o usati, anche mediante aste online.</li>
            <li style={{ marginBottom: '0.75rem' }}>1.3 L’accesso comporta l’accettazione integrale del presente Regolamento.</li>
          </ul>
        </div>

        <div style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', color: '#fff', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            Art. 2 – Ruoli delle parti
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: 'var(--muted)' }}>
            <li style={{ marginBottom: '0.75rem' }}>2.1 "Venditore": utente che offre prodotti; "Acquirente": utente che acquista o partecipa alle aste; "Utente": chiunque acceda alla Piattaforma.</li>
            <li style={{ marginBottom: '0.75rem' }}>2.2 Il Gestore mette a disposizione esclusivamente l’infrastruttura tecnica e non è parte contrattuale delle compravendite.</li>
          </ul>
        </div>

        <div style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', color: '#fff', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            Art. 3 – Registrazione
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: 'var(--muted)' }}>
            <li style={{ marginBottom: '0.75rem' }}>3.1 L’utilizzo è subordinato alla creazione di un account.</li>
            <li style={{ marginBottom: '0.75rem' }}>3.2 Possono registrarsi solo soggetti maggiorenni.</li>
            <li style={{ marginBottom: '0.75rem' }}>3.3 Il Gestore può sospendere l’account in caso di violazione del Regolamento.</li>
          </ul>
        </div>

        <div style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', color: '#fff', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            Art. 4 – Obblighi del Venditore
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: 'var(--muted)' }}>
            <li style={{ marginBottom: '0.75rem' }}>4.1 Il Venditore garantisce la legittima provenienza, indica se i prodotti sono originali o compatibili e fornisce descrizioni veritiere.</li>
            <li style={{ marginBottom: '0.75rem' }}>4.2 È vietata la vendita di prodotti contraffatti o l'uso di account multipli per manipolare le aste.</li>
          </ul>
        </div>

        <div style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', color: '#fff', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            Art. 5 – Obblighi dell’Acquirente
          </h2>
          <p style={{ color: 'var(--muted)', margin: 0 }}>
            5.1 L’Acquirente deve leggere le descrizioni, agire in buona fede e fornire dati di spedizione corretti.
          </p>
        </div>

        <div style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', color: '#fff', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            Art. 6 – Sistema di aste
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: 'var(--muted)' }}>
            <li style={{ marginBottom: '0.75rem' }}>6.1 Le offerte sono vincolanti. L’asta si conclude allo scadere del termine. Se presente un prezzo di riserva, la vendita si perfeziona solo al suo raggiungimento.</li>
            <li style={{ marginBottom: '0.75rem' }}>6.2 È vietato lo "shill bidding" (offerte fittizie).</li>
          </ul>
        </div>

        <div style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', color: '#fff', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            Art. 7 – Pagamenti e commissioni
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: 'var(--muted)' }}>
            <li style={{ marginBottom: '0.75rem' }}>7.1 I pagamenti avvengono tramite sistemi integrati (es. Stripe, PayPal).</li>
            <li style={{ marginBottom: '0.75rem' }}>7.2 Il Gestore trattiene una commissione visibile prima della pubblicazione.</li>
          </ul>
        </div>

        <div style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', color: '#fff', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            Art. 8 – Spedizioni e consegna
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: 'var(--muted)' }}>
            <li style={{ marginBottom: '0.75rem' }}>8.1 Il Venditore è responsabile della spedizione.</li>
            <li style={{ marginBottom: '0.75rem' }}>8.2 Il Gestore non risponde di danni o ritardi imputabili al vettore.</li>
          </ul>
        </div>

        <div style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', color: '#fff', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            Art. 10 – Controversie tra Utenti
          </h2>
          <p style={{ color: 'var(--muted)', margin: 0 }}>
            10.1 Le parti devono cercare una soluzione bonaria. Il Gestore può intervenire come mediatore senza assumerne la responsabilità.
          </p>
        </div>

        <div style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', color: '#fff', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            Art. 11 – Limitazione di responsabilità
          </h2>
          <p style={{ color: 'var(--muted)', margin: 0 }}>
            11.1 Il Gestore non garantisce la qualità o liceità dei prodotti dei Venditori.
          </p>
        </div>

        <div style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', color: '#fff', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            Art. 12 – Modifiche al Regolamento
          </h2>
          <p style={{ color: 'var(--muted)', margin: 0 }}>
            12.1 Il Gestore può modificare il Regolamento in ogni momento previa pubblicazione.
          </p>
        </div>

        <div style={{ marginBottom: '0' }}>
          <h2 style={{ fontSize: '1.5rem', color: '#fff', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            Art. 13 – Legge applicabile e foro competente
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: 'var(--muted)' }}>
            <li style={{ marginBottom: '0.75rem' }}>13.1 Il Regolamento è disciplinato dalla legge italiana.</li>
            <li style={{ marginBottom: '0.75rem' }}>13.2 Foro competente: [Città].</li>
          </ul>
        </div>
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
          Torna alla Home
        </Link>
      </div>
    </div>
  );
}

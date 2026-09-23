// Every issue the audit can raise, in one place: what it means, how bad it is, and how to fix it.
// severity: critical | high | medium | low | info    effort: S (minutes) | M (hours) | L (days)
// Adding a check = add an entry here + emit its id from pageChecks.js / siteChecks.js.

const CATEGORIES = {
  onpage: 'On-page',
  indexability: 'Indicizzazione',
  'structured-data': 'Dati strutturati',
  aeo: 'AEO / visibilità per le IA',
  performance: 'Performance',
  security: 'Sicurezza e configurazione',
};

const CATALOG = {
  // ---- indexability
  'fetch-failed': { category: 'indexability', severity: 'critical', effort: 'M', title: 'Pagina non raggiungibile', fix: 'Verifica che il server risponda entro 15s e che la pagina non vada in errore.' },
  'http-error': { category: 'indexability', severity: 'critical', effort: 'M', title: 'La pagina risponde con errore HTTP', fix: 'Una URL in sitemap deve rispondere 200. Correggi la pagina o rimuovila dalla sitemap.' },
  'redirect-chain': { category: 'indexability', severity: 'medium', effort: 'S', title: 'URL in sitemap che reindirizza', fix: 'Inserisci in sitemap direttamente la URL finale, senza redirect.' },
  noindex: { category: 'indexability', severity: 'critical', effort: 'S', title: 'Pagina in sitemap con noindex', fix: 'Rimuovi il noindex oppure togli la pagina dalla sitemap.' },
  'canonical-missing': { category: 'indexability', severity: 'high', effort: 'S', title: 'Canonical mancante', fix: 'Aggiungi <link rel="canonical"> auto-referenziante.' },
  'canonical-mismatch': { category: 'indexability', severity: 'high', effort: 'S', title: 'Canonical diverso dalla URL della pagina', fix: 'Il canonical deve puntare alla pagina stessa, altrimenti Google la considera un duplicato di un\'altra.' },
  'canonical-offsite': { category: 'indexability', severity: 'critical', effort: 'S', title: 'Canonical verso un altro dominio', fix: 'Il canonical non deve uscire dal dominio: sta cedendo il posizionamento a un altro sito.' },
  'bot-difference': { category: 'indexability', severity: 'high', effort: 'M', title: 'Googlebot vede una pagina diversa dal browser', fix: 'Servi lo stesso contenuto a tutti gli user-agent (il cloaking è penalizzato).' },
  'soft-404': { category: 'indexability', severity: 'high', effort: 'M', title: 'Le pagine inesistenti rispondono 200 invece di 404', fix: 'Nel fallback della SPA rispondi 404 (o 410) quando la rotta non esiste o l\'annuncio non c\'è. Oggi ogni URL inventata è "una pagina valida" per Google.' },
  'robots-missing': { category: 'indexability', severity: 'high', effort: 'S', title: 'robots.txt assente', fix: 'Pubblica /robots.txt con la direttiva Sitemap.' },
  'robots-blocks-all': { category: 'indexability', severity: 'critical', effort: 'S', title: 'robots.txt blocca tutto il sito', fix: 'Rimuovi "Disallow: /" per User-agent: *.' },
  'robots-no-sitemap': { category: 'indexability', severity: 'medium', effort: 'S', title: 'robots.txt senza direttiva Sitemap', fix: 'Aggiungi "Sitemap: https://…/sitemap.xml".' },
  'robots-blocks-sitemap-urls': { category: 'indexability', severity: 'high', effort: 'S', title: 'URL in sitemap bloccate da robots.txt', fix: 'Una pagina in sitemap non può essere disallowed: scegli una delle due.' },
  'sitemap-missing': { category: 'indexability', severity: 'high', effort: 'M', title: 'Sitemap XML assente o non valida', fix: 'Pubblica /sitemap.xml valida (XML, non HTML).' },
  'sitemap-empty': { category: 'indexability', severity: 'high', effort: 'S', title: 'Sitemap senza URL', fix: 'Verifica la generazione della sitemap.' },
  'sitemap-no-lastmod': { category: 'indexability', severity: 'low', effort: 'S', title: 'Sitemap senza <lastmod> per molte URL', fix: 'Aggiungi lastmod reale (data di ultima modifica) dove disponibile; Google ignora quello inesatto.' },
  'hreflang-missing': { category: 'indexability', severity: 'medium', effort: 'L', title: 'Sito multilingua senza hreflang', fix: 'Le lingue condividono lo stesso URL: Google indicizza una sola versione. Servono URL per lingua (/en/, /it/…) con hreflang, oppure va bene restare mono-lingua per i motori.' },

  // ---- on-page
  'title-missing': { category: 'onpage', severity: 'critical', effort: 'S', title: 'Title mancante', fix: 'Ogni pagina deve avere un <title> unico e descrittivo.' },
  'title-length': { category: 'onpage', severity: 'low', effort: 'S', title: 'Title troppo corto o troppo lungo', fix: 'Punta a 30–60 caratteri con la parola chiave principale all\'inizio.' },
  'title-duplicate': { category: 'onpage', severity: 'high', effort: 'M', title: 'Title identico su più pagine', fix: 'Genera un title specifico per rotta (categoria, catalogo, listino…). Oggi quasi tutte le pagine condividono quello della home.' },
  'desc-missing': { category: 'onpage', severity: 'high', effort: 'S', title: 'Meta description mancante', fix: 'Aggiungi una meta description di 70–160 caratteri.' },
  'desc-length': { category: 'onpage', severity: 'low', effort: 'S', title: 'Meta description troppo corta o lunga', fix: 'Tieni la description tra 70 e 160 caratteri.' },
  'desc-duplicate': { category: 'onpage', severity: 'high', effort: 'M', title: 'Meta description identica su più pagine', fix: 'Scrivi una description specifica per ogni tipo di pagina.' },
  'h1-missing': { category: 'onpage', severity: 'medium', effort: 'S', title: 'H1 assente nell\'HTML servito', fix: 'Ogni pagina deve avere un solo H1 già nell\'HTML iniziale.' },
  'h1-multiple': { category: 'onpage', severity: 'low', effort: 'S', title: 'Più di un H1', fix: 'Usa un solo H1 per pagina.' },
  'lang-missing': { category: 'onpage', severity: 'low', effort: 'S', title: 'Attributo lang mancante su <html>', fix: 'Imposta <html lang="it">.' },
  'viewport-missing': { category: 'onpage', severity: 'medium', effort: 'S', title: 'Meta viewport mancante', fix: 'Aggiungi <meta name="viewport" content="width=device-width, initial-scale=1">.' },
  'og-incomplete': { category: 'onpage', severity: 'low', effort: 'S', title: 'Open Graph incompleto', fix: 'Servono og:title, og:description e og:image per le anteprime social.' },
  'twitter-card-missing': { category: 'onpage', severity: 'low', effort: 'S', title: 'Twitter Card mancante', fix: 'Aggiungi twitter:card="summary_large_image".' },
  'img-alt-missing': { category: 'onpage', severity: 'low', effort: 'S', title: 'Immagini senza alt', fix: 'Aggiungi un alt descrittivo (o alt="" se decorativa).' },

  // ---- structured data
  'jsonld-invalid': { category: 'structured-data', severity: 'critical', effort: 'S', title: 'JSON-LD non valido', fix: 'Il blocco non è JSON valido: Google lo ignora.' },
  'product-schema-missing': { category: 'structured-data', severity: 'high', effort: 'M', title: 'Pagina annuncio senza schema Product', fix: 'Aggiungi Product + Offer per abilitare i rich result.' },
  'product-schema-incomplete': { category: 'structured-data', severity: 'medium', effort: 'S', title: 'Schema Product senza campi obbligatori', fix: 'Servono name, image, offers.price, offers.priceCurrency, offers.availability.' },
  'product-schema-recommended': { category: 'structured-data', severity: 'low', effort: 'S', title: 'Schema Product senza campi consigliati', fix: 'Aggiungi brand, sku, itemCondition e seller per rich result più completi.' },
  'breadcrumb-missing': { category: 'structured-data', severity: 'low', effort: 'S', title: 'BreadcrumbList mancante', fix: 'Aggiungi BreadcrumbList per mostrare il percorso nei risultati.' },

  // ---- AEO
  'raw-html-thin': { category: 'aeo', severity: 'high', effort: 'L', title: 'HTML iniziale quasi senza contenuto (serve JavaScript)', fix: 'I crawler delle IA (GPTBot, ClaudeBot, PerplexityBot) di norma non eseguono JavaScript: vedono una pagina vuota. Servi contenuto testuale già nell\'HTML (SSR / pre-rendering per i bot).' },
  'no-internal-links-raw': { category: 'aeo', severity: 'medium', effort: 'L', title: 'Pochi link interni nell\'HTML iniziale', fix: 'I crawler senza JavaScript non possono scoprire le altre pagine: includi la navigazione nell\'HTML servito.' },
  'llms-missing': { category: 'aeo', severity: 'medium', effort: 'S', title: 'llms.txt assente', fix: 'Pubblica /llms.txt (markdown) che descrive il sito e le sezioni principali per i motori IA.' },
  'indexnow-missing': { category: 'aeo', severity: 'low', effort: 'S', title: 'IndexNow non attivo', fix: 'Imposta INDEXNOW_KEY: le nuove pagine vengono segnalate a Bing e altri motori in pochi minuti.' },
  'ai-crawlers-blocked': { category: 'aeo', severity: 'info', effort: 'S', title: 'Crawler IA bloccati da robots.txt', fix: 'Scelta editoriale: se vuoi comparire nelle risposte delle IA, consenti GPTBot, ClaudeBot, PerplexityBot, Google-Extended.' },

  // ---- performance
  'slow-ttfb': { category: 'performance', severity: 'medium', effort: 'M', title: 'Risposta del server lenta (TTFB)', fix: 'Sotto 800ms è l\'obiettivo: cache dell\'HTML, CDN, query più veloci.' },
  'heavy-html': { category: 'performance', severity: 'medium', effort: 'M', title: 'HTML molto pesante', fix: 'Riduci dati inline e markup: sopra i 300KB rallenta parsing e crawl.' },
  'no-compression': { category: 'performance', severity: 'medium', effort: 'S', title: 'Risposta non compressa', fix: 'Abilita gzip o brotli sul server/CDN.' },
  'psi-poor': { category: 'performance', severity: 'high', effort: 'L', title: 'PageSpeed Insights: performance mobile bassa', fix: 'Vedi il dettaglio delle metriche (LCP, CLS, TBT) nel report.' },
  'psi-needs-work': { category: 'performance', severity: 'medium', effort: 'M', title: 'PageSpeed Insights: performance mobile migliorabile', fix: 'Vedi il dettaglio delle metriche (LCP, CLS, TBT) nel report.' },

  // ---- security / config
  'https-redirect-missing': { category: 'security', severity: 'high', effort: 'S', title: 'HTTP non reindirizza a HTTPS', fix: 'Forza il redirect 301 da http:// a https://.' },
  'sec-hsts-missing': { category: 'security', severity: 'medium', effort: 'S', title: 'Header HSTS mancante', fix: 'Aggiungi Strict-Transport-Security (es. max-age=15552000; includeSubDomains).' },
  'sec-csp-missing': { category: 'security', severity: 'low', effort: 'M', title: 'Content-Security-Policy mancante', fix: 'Aggiungi una CSP restrittiva.' },
  'sec-xcto-missing': { category: 'security', severity: 'low', effort: 'S', title: 'X-Content-Type-Options mancante', fix: 'Aggiungi X-Content-Type-Options: nosniff.' },
  'sec-referrer-missing': { category: 'security', severity: 'low', effort: 'S', title: 'Referrer-Policy mancante', fix: 'Aggiungi Referrer-Policy: strict-origin-when-cross-origin.' },
  'sec-frame-missing': { category: 'security', severity: 'low', effort: 'S', title: 'Protezione da clickjacking mancante', fix: 'Aggiungi X-Frame-Options o frame-ancestors nella CSP.' },
};

const SEVERITY_WEIGHT = { critical: 30, high: 16, medium: 7, low: 3, info: 0 };
// How much each area counts toward the overall score (sums to 100).
const CATEGORY_WEIGHT = { onpage: 25, indexability: 25, 'structured-data': 15, aeo: 15, performance: 10, security: 10 };
const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'];
const EFFORT_ORDER = { S: 0, M: 1, L: 2 };

module.exports = { CATALOG, CATEGORIES, CATEGORY_WEIGHT, SEVERITY_WEIGHT, SEVERITY_ORDER, EFFORT_ORDER };

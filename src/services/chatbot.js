/**
 * chatbot.js — Support assistant for the Help Center.
 *
 * Strategy: no vector DB / RAG pipeline — the whole knowledge base is small
 * enough (site overview + FAQ + condensed legal rules) to stuff directly into
 * the prompt on every request. Mirrors the graceful-degradation pattern used
 * by services/gemini.js: if GEMINI_API_KEY is missing or the call fails, we
 * return a canned reply pointing to the FAQ page / support email instead of
 * throwing, so the Help page chat widget always has something to show.
 */

const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
const SUPPORT_EMAIL = 'support@brickmarket.com';

const SITE_KNOWLEDGE = `
# BrickMarket — panoramica del sito
BrickMarket è un marketplace per collezionisti LEGO con tre sezioni principali:
- "Annunci" (/annunci): annunci a prezzo fisso per comprare e vendere set LEGO usati, sigillati o MOC. Pubblicare un annuncio è gratuito.
- "Aste" (/aste): aste a tempo su set da collezione. Le offerte sono vincolanti; se un'offerta arriva negli ultimi 2 minuti, il timer si estende automaticamente (protezione anti-sniping). Alcune aste hanno un prezzo di riserva.
- "Zona Abilità" / ClutchVault Skill Zone (/skill-zone): puzzle a tempo (jigsaw da 50 pezzi) per vincere set o carte da collezione rare, con un sistema di crediti (wallet) acquistabili.
Esiste anche un Catalogo (/catalog) con informazioni sui set LEGO ufficiali (numero set, anno, pezzi, immagini) usato per compilare automaticamente gli annunci.
Gli utenti hanno un profilo con reputazione: dopo ogni transazione è possibile lasciare una recensione. I venditori possono avere badge "PRO" o "Verificato".

# FAQ (domande frequenti, vedi anche la pagina /faq)
D: Chi può usare il marketplace? R: Tutti i maggiorenni possono registrarsi come acquirenti, venditori o entrambi.
D: Si possono vendere solo set LEGO originali? R: Il marketplace è pensato principalmente per prodotti LEGO originali; eventuali prodotti compatibili devono essere chiaramente indicati come tali nella descrizione.
D: Come funzionano le aste? R: Il venditore imposta un prezzo di partenza e una durata. Le offerte sono vincolanti. Allo scadere del tempo vince l'offerta più alta, se raggiunge l'eventuale prezzo di riserva.
D: Cos'è il prezzo di riserva? R: È l'importo minimo che il venditore è disposto ad accettare; se le offerte non lo raggiungono, l'oggetto non viene venduto.
D: Si può comprare subito ("Buy It Now")? R: Se il venditore lo abilita, si può acquistare subito al prezzo indicato, chiudendo l'asta.
D: Come funzionano i pagamenti? R: Tramite metodi sicuri supportati dalla piattaforma (es. Stripe, PayPal).
D: Il marketplace applica una commissione? R: Sì, una commissione viene trattenuta su ogni vendita ed è visibile al venditore prima della pubblicazione.
D: Chi si occupa della spedizione? R: La spedizione è responsabilità del venditore; l'acquirente riceve un tracking se disponibile.
D: Cosa fare se il prodotto arriva danneggiato? R: Contattare subito il venditore tramite la piattaforma; se non si trova un accordo, aprire una segnalazione scrivendo a ${SUPPORT_EMAIL}.
D: Si possono lasciare recensioni? R: Sì, dopo ogni transazione si può lasciare una recensione veritiera e rispettosa del venditore.
D: Si possono avere più account? R: No, è vietato creare più account per aggirare le regole o manipolare aste/recensioni.
D: Come vengono trattati i dati personali? R: Secondo la Privacy Policy della piattaforma, in conformità alle normative vigenti.

# Regolamento (norme legali, versione condensata — vedi anche /norme-legali)
- La piattaforma consente a utenti terzi di vendere e/o comprare prodotti LEGO, anche tramite aste online; l'accesso comporta l'accettazione del regolamento.
- Il gestore fornisce solo l'infrastruttura tecnica e non è parte contrattuale delle compravendite tra utenti.
- Serve un account per usare la piattaforma; possono registrarsi solo maggiorenni; l'account può essere sospeso in caso di violazioni.
- Il venditore garantisce la provenienza legittima dei prodotti, indica se sono originali o compatibili e fornisce descrizioni veritiere; sono vietati prodotti contraffatti e account multipli per manipolare le aste.
- L'acquirente deve leggere le descrizioni, agire in buona fede e fornire dati di spedizione corretti.
- Le offerte d'asta sono vincolanti; è vietato lo "shill bidding" (offerte fittizie proprie).
- I pagamenti avvengono tramite sistemi integrati; il gestore trattiene una commissione visibile prima della pubblicazione.
- Il venditore è responsabile della spedizione; il gestore non risponde di danni o ritardi imputabili al corriere.
- In caso di controversie tra utenti, le parti devono cercare una soluzione bonaria; il gestore può mediare senza assumersene la responsabilità.
- Il regolamento è disciplinato dalla legge italiana e può essere modificato dal gestore previa pubblicazione.

# Contatti
Per problemi che l'assistente non riesce a risolvere (ordini, pagamenti, account, dispute), indirizza sempre l'utente a scrivere a ${SUPPORT_EMAIL} o a consultare la pagina FAQ (/faq).
`.trim();

const SYSTEM_PROMPT = `
Sei l'assistente virtuale del sito BrickMarket, un marketplace di set LEGO da collezione con aste e una modalità puzzle a premi (ClutchVault Skill Zone).
Rispondi SOLO usando le informazioni fornite qui sotto su BrickMarket. Non inventare politiche, prezzi o funzionalità non presenti nel testo.
Rispondi nella stessa lingua del messaggio dell'utente, in modo breve, cordiale e concreto (massimo 4-5 frasi).
Se non conosci la risposta o riguarda un caso specifico dell'account/ordine dell'utente, invita a scrivere a ${SUPPORT_EMAIL} o a consultare la pagina FAQ.
Non fornire consulenza legale o finanziaria personalizzata: per quello rimanda al regolamento (/norme-legali) o al supporto.

--- CONOSCENZA DEL SITO ---
${SITE_KNOWLEDGE}
--- FINE CONOSCENZA DEL SITO ---
`.trim();

const FALLBACK_REPLY =
  `Al momento l'assistente virtuale non è disponibile. ` +
  `Puoi trovare le risposte più comuni nella pagina FAQ oppure scrivere a ${SUPPORT_EMAIL} e ti risponderemo il prima possibile.`;

/**
 * Sends a user message (with optional short history) to Gemini, grounded on
 * the BrickMarket knowledge base above.
 *
 * @param {string} message — the user's latest message
 * @param {Array<{role: 'user'|'bot', text: string}>} history — prior turns, most recent last
 * @returns {Promise<{reply: string, configured: boolean}>}
 */
async function askSupportBot(message, history = []) {
  if (!GEMINI_API_KEY) {
    console.warn('[Chatbot] GEMINI_API_KEY is not set — returning fallback reply.');
    return { reply: FALLBACK_REPLY, configured: false };
  }

  // Keep only the last few turns to bound prompt size / cost.
  const recentHistory = history.slice(-6);
  const historyText = recentHistory
    .map((turn) => `${turn.role === 'user' ? 'Utente' : 'Assistente'}: ${turn.text}`)
    .join('\n');

  const prompt = `${SYSTEM_PROMPT}\n\n--- CONVERSAZIONE ---\n${historyText}\nUtente: ${message}\nAssistente:`;

  try {
    const response = await axios.post(
      GEMINI_URL,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 300,
          temperature: 0.4,
        },
      },
      { timeout: 8000 }
    );

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Empty response from Gemini');
    }

    return { reply: text.trim(), configured: true };
  } catch (err) {
    console.error('[Chatbot] Gemini request failed:', err.message);
    return { reply: FALLBACK_REPLY, configured: true };
  }
}

module.exports = { askSupportBot, SUPPORT_EMAIL };

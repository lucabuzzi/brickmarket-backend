# Cookie Policy di CardBrix

> **BOZZA — NON PUBBLICARE PRIMA DELLA REVISIONE.** Elenco compilato dall'analisi del codice (`client/src/analytics.js`, `src/routes/analyticsTrack.js`, `AuthContext`, `CartContext`). Le voci `[DA VERIFICARE]` vanno confermate ispezionando il sito in produzione (DevTools → Application).

Ultimo aggiornamento: `[DATA]`

Questa informativa spiega come CardBrix (https://cardbrix.com) usa cookie e tecnologie simili (localStorage, sessionStorage). Per i dati personali in generale vedi l'[Informativa sulla privacy](/privacy).

## Come funziona il consenso
Al primo accesso ti chiediamo di **accettare o rifiutare** i cookie di analisi. Rifiutare è semplice quanto accettare e non limita l'uso del sito. Fino alla tua scelta, e se rifiuti, non attiviamo alcun tracciamento statistico. Puoi cambiare idea in qualsiasi momento `[DA IMPLEMENTARE: link "Gestisci cookie" nel footer che riapra il banner]`.

## Tecnologie tecniche (sempre attive, non richiedono consenso)

| Nome | Tipo | Scopo | Durata |
|---|---|---|---|
| `bm_cookie_consent` | Cookie proprio | Ricorda la tua scelta sui cookie | 12 mesi |
| `cardbrix_token` | localStorage | Mantiene il login | Fino al logout |
| Carrello ospite | localStorage | Conserva il carrello prima dell'accesso | Fino allo svuotamento |
| Lingua e suggerimento geografico | localStorage | Ricorda che il suggerimento di lingua è già stato mostrato | Persistente |
| Introduzione al marchio | localStorage | Evita di rivedere l'animazione iniziale nello stesso giorno | Persistente |
| Cloudflare Turnstile | Terza parte | Protezione anti-bot su accesso e registrazione | Sessione `[DA VERIFICARE]` |
| Stripe.js | Terza parte | Pagamento sicuro e prevenzione frodi | `[DA VERIFICARE]` |

## Cookie statistici (solo con il tuo consenso)
Sono di **prima parte**: i dati restano su CardBrix e non li condividiamo con reti pubblicitarie.

| Nome | Tipo | Scopo | Durata |
|---|---|---|---|
| `bm_visitor_id` | Cookie proprio, `HttpOnly` | Identificativo casuale del visitatore per contare visite uniche | 400 giorni |
| `bm_session_id` | sessionStorage | Identificativo casuale della sessione di navigazione | Fino alla chiusura della scheda |

Con il consenso registriamo: pagine visitate, durata della visita (segnale periodico ogni 30 secondi), clic su link e pulsanti (etichetta, tipo, destinazione), eventi come registrazione o accesso, e il paese ricavato dall'IP. Non usiamo questi dati per profilazione pubblicitaria.

## Cookie di marketing o profilazione
Non utilizziamo cookie di marketing né pixel di terze parti. `[DA VERIFICARE prima di pubblicare]`

## Come gestire o cancellare i cookie
- **Da CardBrix:** `[link "Gestisci cookie"]`.
- **Dal browser:** impostazioni del browser → privacy → cookie e dati dei siti (Chrome, Firefox, Safari, Edge). Cancellare `bm_cookie_consent` fa riapparire il banner.

## Titolare e contatti
`[DA COMPILARE: come nell'Informativa]`. Per esercitare i tuoi diritti scrivi a `[EMAIL PRIVACY]`.

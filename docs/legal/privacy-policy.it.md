# Informativa sulla privacy di CardBrix

> **BOZZA — NON PUBBLICARE PRIMA DELLA REVISIONE.** Testo originale, redatto sulla struttura dell'art. 13 GDPR (Reg. UE 2016/679) e compilato con i trattamenti effettivamente presenti nel codice. Le voci `[DA COMPILARE]` e `[DA VERIFICARE]` richiedono dati o conferme del titolare. Non sostituisce una revisione di un legale o del DPO.

Ultimo aggiornamento: `[DATA]`

## 1. Titolare del trattamento
`[DA COMPILARE: ragione sociale / nome e cognome, sede, P. IVA / C.F., email di contatto privacy]`.
Sito: https://cardbrix.com
`[DA VERIFICARE: se nominato, DPO e relativo contatto]`

## 2. Quali dati trattiamo

| Categoria | Dati | Origine |
|---|---|---|
| Account | email, nome utente, password (conservata solo in forma cifrata/hash), lingua preferita | Forniti da te |
| Accesso con Google o Apple | identificativo e email restituiti dal provider | Provider scelto da te |
| Profilo pubblico | avatar, eventuali informazioni che scegli di mostrare, recensioni ricevute | Fornite da te |
| Annunci e aste | titoli, descrizioni, foto, prezzi, offerte | Forniti da te |
| Spedizione | nome, indirizzo, recapiti necessari alla consegna | Forniti da te |
| Ordini e pagamenti | importi, stato dell'ordine, identificativi di transazione. **I dati completi di carta o conto sono gestiti da Stripe e PayPal e non transitano né sono conservati da CardBrix.** | Te e i fornitori di pagamento |
| Verifica venditori | dati di identità richiesti da Stripe Connect per abilitare i pagamenti | Forniti a Stripe |
| Crediti e Skill Zone | movimenti dei crediti (registro con data e causale), partecipazioni ai puzzle | Generati dall'uso del servizio |
| Dati tecnici | indirizzo IP, browser, paese ricavato dall'IP, log di sicurezza | Raccolti automaticamente |
| Segnali anti-abuso | impronte irreversibili (hash SHA-256) di IP, dispositivo, metodo di pagamento e indirizzo di spedizione; non conserviamo il valore in chiaro a questo scopo | Generati dal sistema |
| Statistiche di utilizzo | pagine visitate, durata, clic su link e pulsanti, identificativi di sessione e visitatore | Solo con il tuo consenso (vedi Cookie Policy) |
| Assistenza | contenuto delle richieste che ci invii | Forniti da te |

`[DA VERIFICARE: eventuali altri dati (messaggi tra utenti, telefono, documenti) non emersi dall'analisi del codice]`

## 3. Perché li trattiamo e su quale base

| Finalità | Base giuridica (art. 6 GDPR) |
|---|---|
| Creare e gestire l'account, autenticarti, verificare l'email | Esecuzione del contratto (b) |
| Consentire annunci, aste, acquisti, spedizioni e pagamenti; gestire recensioni e contestazioni | Esecuzione del contratto (b) |
| Gestire i crediti (accredito, maturazione, uso nei puzzle, tenuta del registro) | Esecuzione del contratto (b) |
| Prevenire frodi e abusi dei bonus, inclusi tetti e controlli sui segnali condivisi | Legittimo interesse (f): proteggere la piattaforma e gli utenti |
| Sicurezza informatica, prevenzione bot (Cloudflare Turnstile) | Legittimo interesse (f) |
| Obblighi fiscali, contabili e richieste delle autorità | Obbligo legale (c) |
| Statistiche di utilizzo | Consenso (a), revocabile in ogni momento |
| Invio di email di servizio (verifica, ordini, sicurezza) | Esecuzione del contratto (b) |
| Comunicazioni promozionali `[DA VERIFICARE: se previste]` | Consenso (a) |
| Difesa in giudizio | Legittimo interesse (f) |

**Decisioni automatizzate.** Il sistema può negare o sospendere l'accredito di crediti bonus quando rileva segnali di abuso (ad esempio stesso IP, dispositivo o indirizzo tra venditore e compratore). Puoi chiedere l'intervento di una persona, esprimere la tua opinione e contestare la decisione scrivendo a `[EMAIL PRIVACY]`.

## 4. A chi comunichiamo i dati
Ai fornitori che trattano dati per nostro conto, nominati responsabili del trattamento, o che operano come titolari autonomi:

- **Supabase** (database e infrastruttura)
- **Stripe** e **PayPal** (pagamenti; Stripe anche verifica dei venditori)
- **Cloudinary** (archiviazione e ottimizzazione delle immagini)
- **SendGrid** (invio email)
- **Cloudflare Turnstile** (protezione anti-bot)
- **Google** e **Apple** (solo se scegli l'accesso con il loro account)
- Corrieri e servizi di spedizione `[DA VERIFICARE: nome dei fornitori]`
- Consulenti, commercialisti, autorità competenti quando previsto dalla legge

Gli altri utenti vedono solo i dati necessari alla transazione (ad esempio l'acquirente riceve il nome utente del venditore; il venditore riceve l'indirizzo di spedizione dell'ordine). **Non vendiamo i tuoi dati.**

## 5. Trasferimenti fuori dallo Spazio economico europeo
Alcuni fornitori sopra elencati possono trattare dati negli Stati Uniti o in altri paesi extra-UE. In tal caso il trasferimento avviene sulla base di una decisione di adeguatezza (ad esempio EU-US Data Privacy Framework per i fornitori certificati) o delle Clausole contrattuali standard della Commissione europea. `[DA VERIFICARE: confermare per ciascun fornitore]`

## 6. Per quanto tempo li conserviamo

| Dato | Periodo |
|---|---|
| Account e profilo | Fino alla cancellazione dell'account `[DA COMPILARE]` |
| Ordini, fatture, documenti contabili | 10 anni (obblighi fiscali) |
| Registro dei movimenti dei crediti | `[DA COMPILARE]` |
| Segnali anti-abuso (hash) | `[DA COMPILARE]` |
| Statistiche di utilizzo | `[DA COMPILARE]`; cookie visitatore fino a 400 giorni |
| Richieste di assistenza | `[DA COMPILARE]` |

`[NOTA TECNICA PER IL TITOLARE: nel codice non risulta una procedura automatica di cancellazione o anonimizzazione a scadenza. I periodi indicati vanno definiti e poi implementati.]`

## 7. I tuoi diritti
Puoi chiedere accesso, rettifica, cancellazione, limitazione, portabilità, opposizione al trattamento fondato sul legittimo interesse, e revocare il consenso in qualsiasi momento (la revoca non pregiudica i trattamenti già svolti). Scrivi a `[EMAIL PRIVACY]`; rispondiamo entro un mese. Hai inoltre il diritto di proporre reclamo al **Garante per la protezione dei dati personali** (www.garanteprivacy.it).

## 8. Sicurezza
Usiamo connessioni cifrate (HTTPS), password conservate solo come hash, accessi amministrativi verificati a ogni richiesta e limitazione dei tentativi. Nessun sistema è privo di rischio; in caso di violazione che ti riguardi ti informeremo come previsto dalla legge.

## 9. Minori
Il servizio è destinato a persone di almeno 18 anni. Non raccogliamo consapevolmente dati di minori; se ne veniamo a conoscenza li cancelliamo.

## 10. Crediti
I crediti sono uno strumento interno di CardBrix: non sono acquistabili con denaro, convertibili in denaro né trasferibili tra utenti. Il registro dei movimenti serve a garantire correttezza, prevenzione degli abusi e assistenza.

## 11. Modifiche
Pubblichiamo qui ogni aggiornamento con la nuova data. Per cambiamenti rilevanti ti avviseremo via email o nel sito.

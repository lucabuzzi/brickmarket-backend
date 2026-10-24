// Contenuto delle email transazionali. Solo markup/testo: nessun invio, nessuna dipendenza.
//
// Regole di prodotto (CLAUDE.md): nei testi non c'è mai un rapporto credito/euro e nessun importo di bonus
// scritto a mano (i valori sono configurabili da admin e cambierebbero senza che la mail lo sappia).
// HTML pensato per i client di posta: tabelle, stili inline, nessuna immagine esterna (spesso bloccata,
// e un logo remoto non serve per far arrivare la mail), larghezza fluida fino a 560px.

const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const VERIFY_LINK_TTL_HOURS = 24; // deve restare uguale alla scadenza in authService.sendEmailVerification

function verificationEmail(verifyLink) {
  const link = escapeHtml(verifyLink);
  const preheader = 'Conferma il tuo indirizzo email per attivare il tuo account CardBrix.';

  const text = [
    'Benvenuto su CardBrix!',
    '',
    'Per completare la registrazione conferma il tuo indirizzo email aprendo questo link:',
    verifyLink,
    '',
    `Il link è valido per ${VERIFY_LINK_TTL_HOURS} ore. Dopo la verifica potrai ricevere il bonus di benvenuto in crediti.`,
    '',
    'Se non hai creato tu questo account, puoi ignorare questa email: non verrà fatto nulla.',
    '',
    '— Il team di CardBrix',
    'https://cardbrix.com',
  ].join('\n');

  const html = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<title>Conferma il tuo indirizzo email</title>
</head>
<body style="margin:0;padding:0;background-color:#0b0a10;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0b0a10;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr>
          <td align="center" style="padding:0 0 20px 0;font-family:Helvetica,Arial,sans-serif;font-size:26px;font-weight:800;letter-spacing:0.5px;color:#ffffff;">
            Card<span style="color:#d4af37;">Brix</span>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;border-radius:16px;padding:36px 32px;font-family:Helvetica,Arial,sans-serif;color:#1c1917;">
            <h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;color:#1c1917;">Conferma il tuo indirizzo email</h1>
            <p style="margin:0 0 20px 0;font-size:16px;line-height:1.55;color:#44403c;">
              Benvenuto su CardBrix! Ci siamo quasi: conferma che questo indirizzo è tuo per completare la registrazione.
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
              <tr>
                <td align="center" bgcolor="#d4af37" style="border-radius:10px;">
                  <a href="${link}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;color:#1c1917;text-decoration:none;border-radius:10px;">Conferma email</a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 20px 0;font-size:14px;line-height:1.55;color:#57534e;">
              Dopo la verifica potrai ricevere il bonus di benvenuto in crediti. Il link è valido per ${VERIFY_LINK_TTL_HOURS} ore.
            </p>
            <p style="margin:0 0 6px 0;font-size:13px;line-height:1.5;color:#78716c;">Se il pulsante non funziona, copia e incolla questo indirizzo nel browser:</p>
            <p style="margin:0;font-size:13px;line-height:1.5;word-break:break-all;"><a href="${link}" target="_blank" style="color:#2563eb;">${link}</a></p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:20px 8px 0 8px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#a8a29e;">
            Hai ricevuto questa email perché è stato creato un account su CardBrix con questo indirizzo.<br>
            Se non sei stato tu, puoi ignorarla: non verrà fatto nulla.<br>
            <a href="https://cardbrix.com" target="_blank" style="color:#d4af37;text-decoration:none;">cardbrix.com</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  return { subject: 'Conferma il tuo indirizzo email - CardBrix', text, html };
}

module.exports = { verificationEmail, escapeHtml, VERIFY_LINK_TTL_HOURS };

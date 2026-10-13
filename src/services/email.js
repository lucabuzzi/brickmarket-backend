const nodemailer = require('nodemailer');
const axios = require('axios');

const SENDGRID_SEND_URL = 'https://api.sendgrid.com/v3/mail/send';
const SENDGRID_TIMEOUT_MS = 10000;

const hasSendGridKey = () =>
    Boolean(process.env.SENDGRID_API_KEY) && !process.env.SENDGRID_API_KEY.includes('tuachiave');

// '"CardBrix" <noreply@cardbrix.com>' | 'noreply@cardbrix.com' -> { email, name? }
const parseAddress = (raw) => {
    const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(raw);
    if (m) return m[1].trim() ? { email: m[2].trim(), name: m[1].trim() } : { email: m[2].trim() };
    return { email: String(raw).trim() };
};

// Perché l'API HTTPS e non l'SMTP: Render blocca l'SMTP in uscita (porte 25/465/587) sui web service
// gratuiti, quindi smtp.sendgrid.net:587 non si apriva mai e la richiesta restava appesa senza errore.
// La 443 non è bloccata, e il timeout evita che una richiesta HTTP resti in attesa all'infinito.
const sendViaSendGridApi = async ({ from, to, subject, text, html }) => {
    try {
        const res = await axios.post(
            SENDGRID_SEND_URL,
            {
                personalizations: [{ to: [{ email: to }] }],
                from: parseAddress(from),
                subject,
                content: [
                    { type: 'text/plain', value: text },
                    { type: 'text/html', value: html },
                ],
            },
            {
                headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}` },
                timeout: SENDGRID_TIMEOUT_MS,
            }
        );
        return { messageId: res.headers?.['x-message-id'] || null };
    } catch (err) {
        if (err.response) {
            const detail = (err.response.data?.errors || []).map((e) => e.message).join('; ');
            const e = new Error(`SendGrid ha rifiutato l'invio (HTTP ${err.response.status}): ${detail || 'nessun dettaglio'}`);
            e.status = err.response.status;
            throw e;
        }
        if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
            throw new Error(`SendGrid non ha risposto entro ${SENDGRID_TIMEOUT_MS / 1000}s (${err.code})`);
        }
        throw new Error(`Impossibile contattare SendGrid: ${err.message}`);
    }
};

// Solo sviluppo locale senza chiave: casella finta Ethereal (nessun destinatario reale la riceve).
const sendViaEthereal = async ({ from, to, subject, text, html }) => {
    console.log("SENDGRID key placeholder detected, using ETHEREAL mail fallback");
    const testAccount = await nodemailer.createTestAccount();
    const transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
    });
    const info = await transporter.sendMail({ from, to, subject, text, html });
    console.log("Preview URL test: %s", nodemailer.getTestMessageUrl(info));
    return { messageId: info.messageId };
};

const sendMail = (message) => (hasSendGridKey() ? sendViaSendGridApi(message) : sendViaEthereal(message));

const sendRecoveryEmail = async (toEmail, resetTokenLink) => {
    try {
        const fromEmail = process.env.FROM_EMAIL || '"Supporto BrickMarket" <noreply@brickmarket.com>';

        const info = await sendMail({
            from: fromEmail,
            to: toEmail,
            subject: "Recupero Password - BrickMarket",
            text: `Hai richiesto il reset della password. Vai a questo link per resettarla: ${resetTokenLink}`,
            html: `
              <div style="font-family: sans-serif; padding: 20px;">
                <h2>Supporto BrickMarket</h2>
                <p>Hai richiesto il reset della tua password.</p>
                <p>Clicca sul pulsante sottostante per crearne una nuova:</p>
                <a href="${resetTokenLink}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
                <p style="margin-top: 20px; font-size: 12px; color: #888;">Se non sei stato tu a richiedere il reset, ignora questa email. La tua password è al sicuro.</p>
              </div>
            `,
        });

        console.log("Messaggio inviato: %s", info.messageId);
        return true;
    } catch (error) {
        console.error("Errore invio email:", error.message);
        throw error;
    }
};

const sendVerificationEmail = async (toEmail, verifyLink) => {
    try {
        const fromEmail = process.env.FROM_EMAIL || '"CardBrix" <noreply@cardbrix.com>';

        const info = await sendMail({
            from: fromEmail,
            to: toEmail,
            subject: "Verifica la tua email - CardBrix",
            text: `Conferma il tuo indirizzo email per attivare il bonus di benvenuto: ${verifyLink}`,
            html: `
              <div style="font-family: sans-serif; padding: 20px;">
                <h2>Benvenuto su CardBrix</h2>
                <p>Verifica il tuo indirizzo email per completare la registrazione e ricevere il bonus di benvenuto in crediti.</p>
                <a href="${verifyLink}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verifica Email</a>
                <p style="margin-top: 20px; font-size: 12px; color: #888;">Se non hai creato tu questo account, ignora questa email.</p>
              </div>
            `,
        });

        console.log("Messaggio inviato: %s", info.messageId);
        return true;
    } catch (error) {
        console.error("Errore invio email di verifica:", error.message);
        throw error;
    }
};

module.exports = { sendRecoveryEmail, sendVerificationEmail, parseAddress };

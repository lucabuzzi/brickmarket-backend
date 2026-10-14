const nodemailer = require('nodemailer');
const axios = require('axios');
const { verificationEmail } = require('./emailTemplates');

const SENDGRID_SEND_URL = 'https://api.sendgrid.com/v3/mail/send';
const SENDGRID_TIMEOUT_MS = 10000;

// Il valore è sempre ripulito da spazi/a-capo (copiando la chiave da una pagina web capita di portarseli dietro).
const sendGridKey = () => (process.env.SENDGRID_API_KEY || '').trim();

const hasSendGridKey = () => Boolean(sendGridKey()) && !sendGridKey().includes('tuachiave');

// Perché l'invio è impossibile, senza mai includere il valore della chiave. Se la variabile non esiste ma ne
// esiste una dal nome simile (errore di battitura, spazio nel nome...) lo dice, perché è il caso più frequente.
const sendGridKeyProblem = () => {
    const raw = process.env.SENDGRID_API_KEY;
    if (raw === undefined) {
        const similar = Object.keys(process.env).filter((k) => /send|grid/i.test(k));
        return similar.length
            ? `variabile SENDGRID_API_KEY non trovata (esistono variabili dal nome simile: ${similar.map((k) => JSON.stringify(k)).join(', ')})`
            : 'variabile SENDGRID_API_KEY non trovata';
    }
    if (!raw.trim()) return 'variabile SENDGRID_API_KEY presente ma vuota';
    return 'variabile SENDGRID_API_KEY presente ma contiene il segnaposto "tuachiave"';
};

// '"CardBrix" <noreply@cardbrix.com>' | 'noreply@cardbrix.com' -> { email, name? }
const parseAddress = (raw) => {
    const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(raw);
    if (m) return m[1].trim() ? { email: m[2].trim(), name: m[1].trim() } : { email: m[2].trim() };
    return { email: String(raw).trim() };
};

// Perché l'API HTTPS e non l'SMTP: Render blocca l'SMTP in uscita (porte 25/465/587) sui web service
// gratuiti, quindi smtp.sendgrid.net:587 non si apriva mai e la richiesta restava appesa senza errore.
// La 443 non è bloccata, e il timeout evita che una richiesta HTTP resti in attesa all'infinito.
const replyTo = () => (process.env.REPLY_TO_EMAIL ? parseAddress(process.env.REPLY_TO_EMAIL) : null);

const sendViaSendGridApi = async ({ from, to, subject, text, html }) => {
    try {
        const res = await axios.post(
            SENDGRID_SEND_URL,
            {
                personalizations: [{ to: [{ email: to }] }],
                from: parseAddress(from),
                // Niente tracciamento: i link (verifica email, reset password) devono puntare direttamente a cardbrix.com,
                // non passare da un redirect di terzi (url####.cardbrix.com/ls/click) che può rompersi e vede i token.
                tracking_settings: { click_tracking: { enable: false, enable_text: false }, open_tracking: { enable: false } },
                ...(replyTo() ? { reply_to: replyTo() } : {}),
                subject,
                content: [
                    { type: 'text/plain', value: text },
                    { type: 'text/html', value: html },
                ],
            },
            {
                headers: { Authorization: `Bearer ${sendGridKey()}` },
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

const sendMail = async (message) => {
    if (hasSendGridKey()) return sendViaSendGridApi(message);
    // In produzione Ethereal non consegna a nessun destinatario reale e prova una connessione SMTP che Render
    // blocca (la richiesta restava appesa): meglio fallire subito e con un messaggio che dice cosa manca.
    if (process.env.NODE_ENV === 'production') {
        throw new Error(`SENDGRID_API_KEY mancante, vuota o segnaposto: ${sendGridKeyProblem()}. Impossibile inviare email in produzione (controlla Environment su Render)`);
    }
    return sendViaEthereal(message);
};

const sendRecoveryEmail = async (toEmail, resetTokenLink) => {
    try {
        const fromEmail = process.env.FROM_EMAIL || '"Supporto Cardbrix" <noreply@cardbrix.com>';

        const info = await sendMail({
            from: fromEmail,
            to: toEmail,
            subject: "Recupero Password - Cardbrix",
            text: `Hai richiesto il reset della password. Vai a questo link per resettarla: ${resetTokenLink}`,
            html: `
              <div style="font-family: sans-serif; padding: 20px;">
                <h2>Supporto Cardbrix</h2>
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
        const fromEmail = process.env.FROM_EMAIL || '"Cardbrix" <noreply@cardbrix.com>';

        const info = await sendMail({
            from: fromEmail,
            to: toEmail,
            ...verificationEmail(verifyLink),
        });

        console.log("Messaggio inviato: %s", info.messageId);
        return true;
    } catch (error) {
        console.error("Errore invio email di verifica:", error.message);
        throw error;
    }
};

module.exports = { sendRecoveryEmail, sendVerificationEmail, parseAddress };

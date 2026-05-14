const nodemailer = require('nodemailer');

const initTransporter = async () => {
    // Usa SendGrid se la chiave SENDGRID esiste ed è valida, altrimenti Ethereal
    if (process.env.SENDGRID_API_KEY && !process.env.SENDGRID_API_KEY.includes('tuachiave')) {
        return nodemailer.createTransport({
            host: 'smtp.sendgrid.net',
            port: 587,
            auth: {
                user: 'apikey',
                pass: process.env.SENDGRID_API_KEY
            }
        });
    }

    console.log("SENDGRID key placeholder detected, using ETHEREAL mail fallback");
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false, 
        auth: {
            user: testAccount.user,
            pass: testAccount.pass,
        },
    });
};

const sendRecoveryEmail = async (toEmail, resetTokenLink) => {
    try {
        const transporter = await initTransporter();
        const fromEmail = process.env.FROM_EMAIL || '"Supporto BrickMarket" <noreply@brickmarket.com>';
        
        const info = await transporter.sendMail({
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
        
        if (info.messageId && (!process.env.SENDGRID_API_KEY || process.env.SENDGRID_API_KEY.includes('tuachiave'))) {
            console.log("Preview URL test: %s", nodemailer.getTestMessageUrl(info));
        }

        return true;
    } catch (error) {
        console.error("Errore invio email:", error);
        throw error;
    }
};

module.exports = { sendRecoveryEmail };

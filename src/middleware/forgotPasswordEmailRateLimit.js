const rateLimit = require('express-rate-limit');

// Rate limit dedicato a /forgot-password, chiavato sull'email destinatario
// (normalizzata: trim + lowercase) invece che sull'IP del chiamante.
// Si affianca ad authRateLimit (per-IP, condiviso con login/register/oauth):
// questo limita quante email di reset possono partire verso la STESSA casella
// in una finestra di tempo, anche se le richieste arrivano da IP diversi
// (es. bot distribuito che tenta di floodare la inbox di una vittima nota).
//
// Non sostituisce authRateLimit: entrambi i middleware restano applicati in
// sequenza sulla rotta, non c'è un "al posto di" qui.
//
// La chiave è l'email così come sottomessa dal chiamante (non l'esito della
// lookup su DB) — il comportamento del limiter è identico che l'account
// esista o meno, quindi non introduce un canale di enumerazione: non tocca
// in alcun modo la logica anti-enumeration di authService.requestPasswordReset.
//
// ATTENZIONE — store in-memory: usa il MemoryStore di default di
// express-rate-limit, quindi i contatori vivono nel processo Node e non sono
// condivisi tra istanze. Con un solo processo/istanza backend funziona
// correttamente; se il backend scala orizzontalmente (più repliche/processi,
// es. dietro un load balancer) questo limiter NON è più affidabile — ogni
// istanza conta per conto proprio, quindi il limite reale diventa
// "max * numero di istanze". In quel caso serve uno store condiviso
// (Redis con rate-limit-redis, o una tabella Postgres dedicata).
const forgotPasswordEmailRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const rawEmail = req.body?.email;
    if (typeof rawEmail !== 'string') {
      return 'unknown';
    }
    return rawEmail.trim().toLowerCase();
  },
  message: { error: 'Troppe richieste di reset per questo indirizzo. Riprova più tardi.' },
});

module.exports = forgotPasswordEmailRateLimit;

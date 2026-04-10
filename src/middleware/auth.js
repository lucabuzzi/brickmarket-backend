const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.header('Authorization');
  
  // LOG DI DEBUG: Vediamo cosa arriva davvero nel terminale
  console.log('--- NUOVA RICHIESTA ---');
  console.log('Header Authorization ricevuto:', authHeader);

  if (!authHeader) {
    console.log('ERRORE: Header mancante');
    return res.status(401).json({ error: 'Accesso negato. Token mancante.' });
  }

  // Estraiamo il token (gestendo sia se c'è "Bearer" sia se non c'è)
  const token = authHeader.startsWith('Bearer ') 
    ? authHeader.split(' ')[1] 
    : authHeader;

  console.log('Token estratto:', token ? token.substring(0, 15) + '...' : 'null');

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token VERIFICATO con successo per utente:', verified.userId);
    req.user = verified;
    next();
  } catch (err) {
    console.log('ERRORE DI VERIFICA:', err.message);
    console.log('Segreto usato dal server:', process.env.JWT_SECRET);
    res.status(403).json({ error: 'Token non valido' });
  }
};
const fs = require('fs');
const langs = ['it', 'en', 'de', 'es', 'fr'];
const newAuthFlags = {
  it: {
    extending: 'Tempo esteso!',
    winning_bid: 'Aggiudicato a {{username}} per {{amount}}!',
    outbid_warning: 'Sei stato superato!',
    ended: 'Asta conclusa',
    error_expired: 'L\'asta è scaduta.'
  },
  en: {
    extending: 'Time extended!',
    winning_bid: 'Won by {{username}} for {{amount}}!',
    outbid_warning: 'You have been outbid!',
    ended: 'Auction ended',
    error_expired: 'The auction has expired.'
  },
  de: {
    extending: 'Zeit verlängert!',
    winning_bid: 'Vergeben an {{username}} für {{amount}}!',
    outbid_warning: 'Sie wurden überboten!',
    ended: 'Auktion beendet',
    error_expired: 'Die Auktion ist abgelaufen.'
  },
  es: {
    extending: '¡Tiempo añadido!',
    winning_bid: '¡Adjudicado a {{username}} por {{amount}}!',
    outbid_warning: '¡Te han superado!',
    ended: 'Subasta finalizada',
    error_expired: 'La subasta ha expirado.'
  },
  fr: {
    extending: 'Temps prolongé !',
    winning_bid: 'Adjugé à {{username}} pour {{amount}} !',
    outbid_warning: 'Vous avez été surenchéri !',
    ended: 'Enchère terminée',
    error_expired: 'L\'enchère a expiré.'
  }
};

for (const lang of langs) {
  const path = `C:/Users/lucab/brickmarket-backend/client/src/locales/${lang}.json`;
  if (fs.existsSync(path)) {
    const data = JSON.parse(fs.readFileSync(path, 'utf8'));
    data.auction = data.auction || {};
    Object.assign(data.auction, newAuthFlags[lang]);
    fs.writeFileSync(path, JSON.stringify(data, null, 2));
  }
}
console.log('Locales updated');

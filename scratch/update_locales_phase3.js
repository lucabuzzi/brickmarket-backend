const fs = require('fs');
const langs = ['it', 'en', 'de', 'es', 'fr'];
const newKeys = {
  it: {
    notifications: { outbid: 'Offerta superata su {{item}}!' },
    profile: { my_bids: 'Le Mie Offerte' },
    auction: { winning: 'Stai vincendo!', lost: 'Asta persa', won: 'Asta vinta!' }
  },
  en: {
    notifications: { outbid: 'Outbid on {{item}}!' },
    profile: { my_bids: 'My Bids' },
    auction: { winning: 'Leading bid!', lost: 'Auction lost', won: 'Auction won!' }
  },
  de: {
    notifications: { outbid: 'Überboten bei {{item}}!' },
    profile: { my_bids: 'Meine Gebote' },
    auction: { winning: 'Höchstbietender!', lost: 'Auktion verloren', won: 'Auktion gewonnen!' }
  },
  es: {
    notifications: { outbid: '¡Superado en {{item}}!' },
    profile: { my_bids: 'Mis Pujas' },
    auction: { winning: '¡Ganando!', lost: 'Subasta perdida', won: '¡Subasta ganada!' }
  },
  fr: {
    notifications: { outbid: 'Surenchéri sur {{item}} !' },
    profile: { my_bids: 'Mes Enchères' },
    auction: { winning: 'En tête !', lost: 'Enchère perdue', won: 'Enchère gagnée !' }
  }
};

for (const lang of langs) {
  const path = `C:/Users/lucab/brickmarket-backend/client/src/locales/${lang}.json`;
  if (fs.existsSync(path)) {
    const data = JSON.parse(fs.readFileSync(path, 'utf8'));
    data.notifications = { ...(data.notifications || {}), ...newKeys[lang].notifications };
    data.profile = { ...(data.profile || {}), ...newKeys[lang].profile };
    data.auction = { ...(data.auction || {}), ...newKeys[lang].auction };
    fs.writeFileSync(path, JSON.stringify(data, null, 2));
  }
}
console.log('Locales updated for Phase 3.');

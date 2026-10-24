// HTTP adapter for the admin dashboard and analytics pages.
const handle = require('../../../http/handle');
const analytics = require('./analytics.service');

module.exports = {
  stats: handle(async (req, res) => {
    res.json(await analytics.platformStats());
  }, { log: 'ADMIN STATS ERROR:', error: 'Errore nel recupero delle statistiche admin.' }),

  interactions: handle(async (req, res) => {
    res.json(await analytics.tradingPairs());
  }, { log: 'ADMIN INTERACTIONS ERROR:', error: 'Errore nel recupero delle interazioni.' }),

  overview: handle(async (req, res) => {
    res.json(await analytics.trafficOverview());
  }, { log: 'ADMIN ANALYTICS ERROR:', error: 'Errore nel recupero delle statistiche di analytics.' }),

  sessions: handle(async (req, res) => {
    res.json(await analytics.recentSessions(req.query.limit));
  }, { log: 'ADMIN ANALYTICS SESSIONS ERROR:', error: 'Errore nel recupero delle sessioni.' }),

  behavior: handle(async (req, res) => {
    res.json(await analytics.behavior());
  }, { log: 'ADMIN ANALYTICS BEHAVIOR ERROR:', error: 'Errore nel recupero del comportamento utenti.' }),

  calendar: handle(async (req, res) => {
    res.json(await analytics.calendar(req.query.year, req.query.month));
  }, { log: 'ADMIN ANALYTICS CALENDAR ERROR:', error: 'Errore nel recupero del calendario analytics.' }),

  day: handle(async (req, res) => {
    res.json(await analytics.day(req.query.date));
  }, { log: 'ADMIN ANALYTICS DAY ERROR:', error: 'Errore nel recupero dei dati del giorno.' }),

  backfill: handle(async (req, res) => {
    res.json(await analytics.backfill((req.body || {}).fromDate));
  }, { log: 'ADMIN ANALYTICS BACKFILL ERROR:', error: 'Errore durante il backfill degli snapshot.' }),
};

// GET /api/contest/list tells callers when its contests come from the in-memory mock of clutchvault-db (no real
// database reachable): the game must not present those placeholder prizes as real.
jest.mock('../src/repositories/contestRepository', () => ({
  listOpenContests: jest.fn(),
  isMockDb: jest.fn(),
}));
jest.mock('../src/services/image', () => ({ uploadOrSaveProcessedImage: jest.fn() }));

const repo = require('../src/repositories/contestRepository');
const { listContestsHandler } = require('../src/controllers/contestController');

function res() {
  const r = { statusCode: 200, body: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}

const ROW = {
  id: 7, product_id: 3, title: 'Set', image_url: '/uploads/x.png', category: 'lego', market_value: '99.00', condition: 'new',
  grading_info: null, total_slots: 30, filled_slots: 4, slot_cost_credits: '5', status: 'open', winner_id: null,
};

test('real database: mock is false', async () => {
  repo.listOpenContests.mockResolvedValue([ROW]);
  repo.isMockDb.mockReturnValue(false);
  const r = res();
  await listContestsHandler({}, r);
  expect(r.body.mock).toBe(false);
  expect(r.body.contests[0]).toMatchObject({ id: 7, totalSlots: 30, filledSlots: 4, slotCostCredits: 5, status: 'open' });
});

test('in-memory fallback: mock is true', async () => {
  repo.listOpenContests.mockResolvedValue([ROW]);
  repo.isMockDb.mockReturnValue(true);
  const r = res();
  await listContestsHandler({}, r);
  expect(r.body.mock).toBe(true);
});

test('isMockDb mirrors clutchvault-db', () => {
  jest.isolateModules(() => {
    jest.unmock('../src/repositories/contestRepository');
    jest.doMock('../src/db/clutchvault-db', () => ({ isMock: true, query: jest.fn() }));
    expect(require('../src/repositories/contestRepository').isMockDb()).toBe(true);
  });
});

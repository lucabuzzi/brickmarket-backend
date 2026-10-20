// GET /api/users/profile/:username (the public profile the game inventory page reads) with the DB mocked:
// it must now return the player's character (avatar_config) and still never select private columns.
jest.mock('../src/db', () => ({ query: jest.fn() }));
jest.mock('../src/middleware/auth', () => (req, res, next) => next());

const db = require('../src/db');
const router = require('../src/routes/users');

function handlerFor(path) {
  const layer = router.stack.find((l) => l.route && l.route.path === path && l.route.methods.get);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}
function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

test('the public profile includes avatar_config and no private fields', async () => {
  const avatar = { v: 2, look: 'donna_cyber', skin: 1, hairColor: 2, outfitColor: 3, accentColor: 4, legsColor: 5 };
  db.query
    .mockResolvedValueOnce({ rows: [{ id: 'u1', username: 'giulia', avatar_config: avatar }] })
    .mockResolvedValueOnce({ rows: [{ id: 'l1', status: 'active' }, { id: 'l2', status: 'sold' }] })
    .mockResolvedValueOnce({ rows: [] });
  const res = mockRes();
  await handlerFor('/profile/:username')({ params: { username: 'giulia' } }, res);

  const userSql = db.query.mock.calls[0][0];
  expect(userSql).toMatch(/avatar_config/);
  for (const secret of ['email', 'password_hash', 'iban', 'fiscal_code', 'phone', 'address_street']) {
    expect(userSql).not.toMatch(new RegExp(`\\b${secret}\\b`));
  }
  const body = res.json.mock.calls[0][0];
  expect(body.user.avatar_config).toEqual(avatar);
  expect(body.listings.active.map((l) => l.id)).toEqual(['l1']);
});

test('an unknown username answers 404', async () => {
  db.query.mockReset();
  db.query.mockResolvedValueOnce({ rows: [] });
  const res = mockRes();
  await handlerFor('/profile/:username')({ params: { username: 'nobody' } }, res);
  expect(res.status).toHaveBeenCalledWith(404);
});

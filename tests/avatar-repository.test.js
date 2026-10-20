// The REAL userRepository SQL with the database module mocked: checks that avatar_config is written on sign-up
// and on profile update, and read back by findById / the profile RETURNING clause. No DB, no network.
jest.mock('../src/db', () => ({ query: jest.fn(), getClient: jest.fn() }));

const db = require('../src/db');
const userRepository = require('../src/repositories/userRepository');

const avatar = { v: 2, look: 'uomo_cyber', skin: 2, hairColor: 1, outfitColor: 0, accentColor: 4, legsColor: 0 };

beforeEach(() => {
  db.query.mockReset();
  db.query.mockResolvedValue({ rows: [{ id: 'u1' }] });
});

describe('createUser', () => {
  const base = { email: 'A@Example.com', passwordHash: 'h', username: 'gamer1', role: 'user', referralCode: 'ABCD2345' };

  test('writes avatar_config as JSON text in the 19th placeholder', async () => {
    await userRepository.createUser({ ...base, avatarConfig: avatar });
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/avatar_config/);
    expect(sql).toMatch(/\$19\)/);
    expect(params).toHaveLength(19);
    expect(JSON.parse(params[18])).toEqual(avatar);
    expect(params[0]).toBe('a@example.com');
  });

  test('stores NULL when the sign-up carries no avatar (the normal site form)', async () => {
    await userRepository.createUser(base);
    expect(db.query.mock.calls[0][1][18]).toBeNull();
  });
});

describe('updateProfile / findById', () => {
  test('updateProfile sets avatar_config and returns it', async () => {
    await userRepository.updateProfile('u1', { avatar_config: JSON.stringify(avatar) });
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/SET avatar_config = \$1/);
    expect(sql).toMatch(/RETURNING[\s\S]*avatar_config/);
    expect(params).toEqual([JSON.stringify(avatar), 'u1']);
  });

  test('findById selects avatar_config', async () => {
    await userRepository.findById('u1');
    expect(db.query.mock.calls[0][0]).toMatch(/avatar_config/);
  });
});

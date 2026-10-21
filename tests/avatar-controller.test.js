// The REAL auth controller + validators with every collaborator mocked (no DB, no network): proves that the
// avatar the game sends at sign-up / profile update reaches the service and the repository in the right shape,
// and that an invalid avatar is refused before anything is written.
jest.mock('../src/services/authService', () => ({
  register: jest.fn(),
  AuthError: class AuthError extends Error {},
}));
jest.mock('../src/repositories/userRepository', () => ({ findById: jest.fn(), updateProfile: jest.fn() }));
jest.mock('../src/repositories/identitySignalRepository', () => ({ recordAddressSignal: jest.fn() }));
jest.mock('../src/services/image', () => ({ uploadOrSaveProcessedImage: jest.fn() }));
jest.mock('../src/services/turnstile', () => ({ verifyTurnstile: jest.fn() }));
jest.mock('../src/services/googleAuth', () => ({ verifyGoogleIdToken: jest.fn() }));
jest.mock('../src/services/appleAuth', () => ({ verifyAppleIdToken: jest.fn() }));

const authService = require('../src/services/authService');
const userRepository = require('../src/repositories/userRepository');
const { verifyTurnstile } = require('../src/services/turnstile');
const { registerHandler, updateMeHandler, meHandler } = require('../src/controllers/authController');
const { defaultAvatarConfig } = require('../src/services/avatarConfig');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

const avatar = { ...defaultAvatarConfig(), look: 'donna_cyber', skin: 3, hairColor: 8 };
const signup = { email: 'gamer@example.com', password: 'password123', username: 'gamer1', turnstileToken: 'tok' };

beforeEach(() => {
  jest.clearAllMocks();
  verifyTurnstile.mockResolvedValue(true);
  authService.register.mockResolvedValue({ token: 't', user: { id: 'u1' } });
  userRepository.updateProfile.mockResolvedValue({ id: 'u1', username: 'gamer1' });
});

describe('POST /api/auth/register (registerHandler)', () => {
  const reqWith = (body) => ({ body, files: {}, ip: '1.2.3.4', headers: { 'user-agent': 'jest' } });

  test('passes the avatar (sent as a multipart JSON string) to the service as a validated object', async () => {
    const res = mockRes();
    await registerHandler(reqWith({ ...signup, avatarConfig: JSON.stringify(avatar) }), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(authService.register).toHaveBeenCalledTimes(1);
    expect(authService.register.mock.calls[0][0].avatarConfig).toEqual(avatar);
  });

  test('a sign-up without an avatar (the normal site form) still works and sends null', async () => {
    const res = mockRes();
    await registerHandler(reqWith(signup), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(authService.register.mock.calls[0][0].avatarConfig).toBeNull();
  });

  test('a legacy (v1) avatar is converted to v2 before it is stored', async () => {
    const res = mockRes();
    const v1 = { skin: 1, hairStyle: 0, hairColor: 2, outfit: 3, outfitColor: 4, accessory: 0 };
    await registerHandler(reqWith({ ...signup, avatarConfig: JSON.stringify(v1) }), res);
    expect(authService.register.mock.calls[0][0].avatarConfig).toMatchObject({ v: 2, look: require('../client/src/config/avatarSpec.json').looks[0], skin: 2, hairColor: 3, outfitColor: 5 });
  });

  test('an invalid avatar is refused with 400 and nothing is registered', async () => {
    const res = mockRes();
    await registerHandler(reqWith({ ...signup, avatarConfig: JSON.stringify({ v: 2, look: 'hacker' }) }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Personaggio non valido' });
    expect(authService.register).not.toHaveBeenCalled();
  });

  test('the anti-bot check still runs for game sign-ups', async () => {
    verifyTurnstile.mockResolvedValue(false);
    const res = mockRes();
    await registerHandler(reqWith({ ...signup, avatarConfig: JSON.stringify(avatar) }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(authService.register).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/auth/me (updateMeHandler)', () => {
  const reqWith = (body) => ({ body, user: { userId: 'u1' } });

  test('saves a valid avatar as JSON text in avatar_config and returns the updated profile', async () => {
    const res = mockRes();
    await updateMeHandler(reqWith({ avatarConfig: JSON.stringify(avatar) }), res);
    expect(userRepository.updateProfile).toHaveBeenCalledWith('u1', { avatar_config: JSON.stringify(avatar) });
    expect(res.json).toHaveBeenCalledWith({ id: 'u1', username: 'gamer1' });
  });

  test('also accepts the avatar together with other profile fields', async () => {
    const res = mockRes();
    await updateMeHandler(reqWith({ city: 'Roma', avatarConfig: JSON.stringify(avatar) }), res);
    expect(userRepository.updateProfile).toHaveBeenCalledWith('u1', { city: 'Roma', avatar_config: JSON.stringify(avatar) });
  });

  test.each([
    ['unknown look', { v: 2, look: 'nope' }],
    ['colour out of range', { ...avatar, legsColor: 99 }],
    ['not an avatar at all', 'garbage'],
  ])('refuses %s with 400 and writes nothing', async (_label, bad) => {
    const res = mockRes();
    await updateMeHandler(reqWith({ avatarConfig: typeof bad === 'string' ? bad : JSON.stringify(bad) }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(userRepository.updateProfile).not.toHaveBeenCalled();
  });

  test('an empty update is still refused (the avatar is not magically required)', async () => {
    const res = mockRes();
    await updateMeHandler(reqWith({}), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Nessun dato da aggiornare' });
  });

  test('a profile that does not exist answers 404', async () => {
    userRepository.updateProfile.mockResolvedValue(null);
    const res = mockRes();
    await updateMeHandler(reqWith({ avatarConfig: JSON.stringify(avatar) }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('GET /api/auth/me (meHandler)', () => {
  test('returns whatever the repository gives, avatar_config included', async () => {
    userRepository.findById.mockResolvedValue({ id: 'u1', avatar_config: avatar });
    const res = mockRes();
    await meHandler({ user: { userId: 'u1' } }, res);
    expect(res.json).toHaveBeenCalledWith({ id: 'u1', avatar_config: avatar });
  });
});

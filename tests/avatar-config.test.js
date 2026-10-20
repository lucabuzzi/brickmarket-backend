// Server-side validation of the game avatar (src/services/avatarConfig.js + the Joi schemas the real routes use).
// Pure unit tests (no DB, no server): looks and option counts come from client/src/config/avatarSpec.json.
const {
  AVATAR_LOOKS, AVATAR_COLOR_PARTS, AVATAR_SPEC, defaultAvatarConfig, normalizeAvatarConfig,
} = require('../src/services/avatarConfig');
const { registerSchema, updateProfileSchema, validate } = require('../src/validators/authValidators');

const baseRegister = { email: 'a@example.com', password: 'password123', username: 'brick_fan' };
const v1 = { skin: 2, hairStyle: 1, hairColor: 3, outfit: 4, outfitColor: 5, accessory: 2 };

describe('normalizeAvatarConfig (version 2)', () => {
  test('the default avatar is valid, uses the first look and keeps every colour as drawn', () => {
    const def = defaultAvatarConfig();
    expect(def).toEqual({ v: 2, look: AVATAR_LOOKS[0], skin: 0, hairColor: 0, outfitColor: 0, accentColor: 0, legsColor: 0 });
    expect(normalizeAvatarConfig(def)).toEqual(def);
  });

  test('accepts every look and the highest index of every colour part', () => {
    for (const look of AVATAR_LOOKS) {
      const max = { v: 2, look, ...Object.fromEntries(AVATAR_COLOR_PARTS.map((p) => [p, AVATAR_SPEC[p] - 1])) };
      expect(normalizeAvatarConfig(max)).toEqual(max);
    }
  });

  test('accepts a JSON string (multipart forms send strings)', () => {
    const def = defaultAvatarConfig();
    expect(normalizeAvatarConfig(JSON.stringify(def))).toEqual(def);
  });

  test.each([
    ['null', null], ['an array', []], ['a number', 3], ['broken JSON', '{nope'], ['an oversized string', 'x'.repeat(600)],
  ])('rejects %s', (_label, input) => {
    expect(normalizeAvatarConfig(input)).toBeNull();
  });

  test('rejects an unknown look, a wrong version or a missing look', () => {
    const def = defaultAvatarConfig();
    expect(normalizeAvatarConfig({ ...def, look: 'drago' })).toBeNull();
    expect(normalizeAvatarConfig({ ...def, look: undefined })).toBeNull();
    expect(normalizeAvatarConfig({ ...def, v: 3 })).toBeNull();
    expect(normalizeAvatarConfig({ ...def, look: '__proto__' })).toBeNull();
  });

  test.each(AVATAR_COLOR_PARTS)('rejects out-of-range, negative, fractional and string values for %s', (part) => {
    const base = defaultAvatarConfig();
    for (const bad of [AVATAR_SPEC[part], -1, 1.5, '1', null, NaN]) {
      expect(normalizeAvatarConfig({ ...base, [part]: bad })).toBeNull();
    }
  });

  test('rejects a config with a missing colour part', () => {
    const { skin, ...rest } = defaultAvatarConfig();
    expect(skin).toBe(0);
    expect(normalizeAvatarConfig(rest)).toBeNull();
  });

  test('drops unknown keys so arbitrary data cannot be stored', () => {
    const out = normalizeAvatarConfig({ ...defaultAvatarConfig(), evil: 'x', __proto__: { a: 1 } });
    expect(out).toEqual(defaultAvatarConfig());
    expect(out).not.toHaveProperty('evil');
  });
});

describe('legacy (version 1) avatars are converted, not lost', () => {
  test('maps a saved v1 avatar to the first look, shifting each swatch by one (0 now means "as drawn")', () => {
    expect(normalizeAvatarConfig(v1)).toEqual({ v: 2, look: AVATAR_LOOKS[0], skin: 3, hairColor: 4, outfitColor: 6, accentColor: 0, legsColor: 0 });
    expect(normalizeAvatarConfig(JSON.stringify(v1))).toEqual(normalizeAvatarConfig(v1));
  });

  test('a converted avatar is itself valid v2', () => {
    const conv = normalizeAvatarConfig(v1);
    expect(normalizeAvatarConfig(conv)).toEqual(conv);
  });

  test('the highest v1 values still fit, and out-of-range v1 values are rejected', () => {
    expect(normalizeAvatarConfig({ skin: 5, hairStyle: 5, hairColor: 7, outfit: 5, outfitColor: 7, accessory: 5 })).not.toBeNull();
    expect(normalizeAvatarConfig({ ...v1, skin: 6 })).toBeNull();
    expect(normalizeAvatarConfig({ ...v1, hairColor: -1 })).toBeNull();
    expect(normalizeAvatarConfig({ skin: 1 })).toBeNull();
  });
});

describe('validators', () => {
  test('registration without an avatar is still valid (avatar is optional)', () => {
    const { error, value } = validate(registerSchema, baseRegister);
    expect(error).toBeNull();
    expect(value.avatarConfig).toBeUndefined();
  });

  test('registration accepts a v2 avatar sent as a JSON string, and returns it as an object', () => {
    const avatar = { ...defaultAvatarConfig(), look: AVATAR_LOOKS[2], skin: 3 };
    const { error, value } = validate(registerSchema, { ...baseRegister, avatarConfig: JSON.stringify(avatar) });
    expect(error).toBeNull();
    expect(value.avatarConfig).toEqual(avatar);
  });

  test('registration converts a legacy avatar and rejects an invalid one', () => {
    const ok = validate(registerSchema, { ...baseRegister, avatarConfig: JSON.stringify(v1) });
    expect(ok.error).toBeNull();
    expect(ok.value.avatarConfig.v).toBe(2);
    const bad = validate(registerSchema, { ...baseRegister, avatarConfig: JSON.stringify({ v: 2, look: 'nope' }) });
    expect(bad.error).toBe('Personaggio non valido');
  });

  test('profile update accepts and rejects avatars the same way', () => {
    expect(validate(updateProfileSchema, { avatarConfig: defaultAvatarConfig() }).error).toBeNull();
    const bad = validate(updateProfileSchema, { avatarConfig: { ...defaultAvatarConfig(), legsColor: 99 } });
    expect(bad.error).toBe('Personaggio non valido');
  });
});

// users.address_country -> ISO alpha-2 uppercase. Pure logic: no DB, no network (there is no test DB yet).
const be = require('../src/utils/country');
const fe = require('../client/src/lib/country.js');
const { validate, updateProfileSchema, registerSchema } = require('../src/validators/authValidators');
const data = require('../client/src/config/countries.json');

describe('normalizeCountry (backend)', () => {
  test.each([
    ['it', 'IT'], ['IT', 'IT'], ['Italia', 'IT'], ['ITALIA', 'IT'], [' italia ', 'IT'], ['Italy', 'IT'], ['Italien', 'IT'],
    ['Svizzera', 'CH'], ['Suisse', 'CH'], ['Schweiz', 'CH'],
    ['Germania', 'DE'], ['Deutschland', 'DE'], ['Österreich', 'AT'], ['osterreich', 'AT'], ['Austria', 'AT'],
    ['Paesi Bassi', 'NL'], ['Olanda', 'NL'], ['Holland', 'NL'], ['Spagna', 'ES'], ['España', 'ES'],
    ['Regno Unito', 'GB'], ['UK', 'GB'], ['U.K.', 'GB'], ['United Kingdom', 'GB'], ['gb', 'GB'],
    ['Repubblica Ceca', 'CZ'], ['Czechia', 'CZ'], ['San Marino', 'SM'], ['Francia', 'FR'], ['Grecia', 'GR'],
  ])('%j -> %s', (input, expected) => {
    expect(be.normalizeCountry(input)).toBe(expected);
  });

  test.each([[''], ['   '], [null], [undefined], ['Narnia'], ['US'], ['Stati Uniti'], ['xx']])('%j -> null', (input) => {
    expect(be.normalizeCountry(input)).toBeNull();
  });

  test('every supported code resolves to itself, in either case', () => {
    for (const code of data.codes) {
      expect(be.normalizeCountry(code)).toBe(code);
      expect(be.normalizeCountry(code.toLowerCase())).toBe(code);
    }
  });

  test('scope is UE27 + CH + GB + SM', () => {
    expect(data.codes).toHaveLength(30);
    expect(new Set(data.codes).size).toBe(30);
    for (const c of ['IT', 'DE', 'FR', 'ES', 'PL', 'SE', 'IE', 'MT', 'CY', 'LU', 'CH', 'GB', 'SM']) expect(data.codes).toContain(c);
  });
});

describe('frontend and backend agree', () => {
  const samples = ['it', 'IT', 'Italia', 'ITALIA', 'Italy', 'Svizzera', 'Österreich', 'UK', 'U.K.', 'Olanda', 'Narnia', '', '  ', null, undefined, 'xx', 'Repubblica Ceca'];
  test('normalizeCountry gives identical answers', () => {
    for (const s of samples) expect([s, fe.normalizeCountry(s)]).toEqual([s, be.normalizeCountry(s)]);
  });
  test('same supported list', () => {
    expect(fe.SUPPORTED_COUNTRY_CODES).toEqual(be.SUPPORTED_COUNTRY_CODES);
  });
});

describe('frontend helpers', () => {
  test('countryName is localized and falls back to the code', () => {
    expect(fe.countryName('IT', 'it')).toBe('Italia');
    expect(fe.countryName('IT', 'en')).toBe('Italy');
    expect(fe.countryName('DE', 'de')).toBe('Deutschland');
    expect(fe.countryName('', 'it')).toBe('');
  });
  test('countryOptions lists all 30 countries sorted by name', () => {
    const opts = fe.countryOptions('it');
    expect(opts).toHaveLength(30);
    const names = opts.map((o) => o.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'it')));
  });
  test('flagClass', () => {
    expect(fe.flagClass('Italia')).toBe('fi fi-it');
    expect(fe.flagClass('Narnia')).toBe('');
    expect(fe.flagClass(null)).toBe('');
  });
});

describe('validators store ISO codes', () => {
  test('update profile: "Italia" is stored as IT', () => {
    const { error, value } = validate(updateProfileSchema, { country: 'Italia' });
    expect(error).toBeNull();
    expect(value.country).toBe('IT');
  });
  test('update profile: lowercase code is uppercased', () => {
    expect(validate(updateProfileSchema, { country: 'it' }).value.country).toBe('IT');
  });
  test('empty / null are still allowed (clear the field)', () => {
    expect(validate(updateProfileSchema, { country: '' }).error).toBeNull();
    expect(validate(updateProfileSchema, { country: null }).error).toBeNull();
    expect(validate(updateProfileSchema, { city: 'Milano' }).error).toBeNull();
  });
  test('unsupported country is rejected with a clear message', () => {
    const { error } = validate(updateProfileSchema, { country: 'Narnia' });
    expect(error).toBe('Paese non supportato');
  });
  test('register applies the same rule', () => {
    const base = { email: 'a@b.it', password: 'longenough1', username: 'tester' };
    expect(validate(registerSchema, { ...base, country: 'Svizzera' }).value.country).toBe('CH');
    expect(validate(registerSchema, { ...base, country: 'Atlantide' }).error).toBe('Paese non supportato');
  });
});

describe('planCountryNormalization (data migration)', () => {
  const rows = [
    { id: 1, address_country: 'it' },
    { id: 2, address_country: 'IT' },
    { id: 3, address_country: 'Italia' },
    { id: 4, address_country: 'ITALIA' },
    { id: 5, address_country: 'Narnia' },
    { id: 6, address_country: '' },
    { id: 7, address_country: null },
    { id: 8, address_country: 'Svizzera' },
  ];
  const plan = be.planCountryNormalization(rows);

  test('changes only rows whose value differs from the canonical code', () => {
    expect(plan.changes).toEqual([
      { id: 1, old: 'it', code: 'IT' },
      { id: 3, old: 'Italia', code: 'IT' },
      { id: 4, old: 'ITALIA', code: 'IT' },
      { id: 8, old: 'Svizzera', code: 'CH' },
    ]);
  });
  test('unknown values are reported, never guessed or changed', () => {
    expect(plan.unrecognized).toEqual([{ id: 5, old: 'Narnia' }]);
  });
  test('idempotent: running the plan on already-migrated data changes nothing', () => {
    const migrated = rows.map((r) => {
      const c = plan.changes.find((x) => x.id === r.id);
      return c ? { ...r, address_country: c.code } : r;
    });
    const again = be.planCountryNormalization(migrated);
    expect(again.changes).toEqual([]);
    expect(again.unrecognized).toEqual([{ id: 5, old: 'Narnia' }]);
  });
});

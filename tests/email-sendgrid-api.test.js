// email.js sends through SendGrid's HTTPS API (Render blocks outbound SMTP on free instances). axios is mocked:
// no network, no real email, no DB.
jest.mock('axios');
const axios = require('axios');

const loadEmail = () => {
  jest.resetModules();
  jest.doMock('axios', () => axios);
  return require('../src/services/email');
};

describe('parseAddress', () => {
  const { parseAddress } = loadEmail();
  test('"Name" <addr>', () => expect(parseAddress('"CardBrix" <noreply@cardbrix.com>')).toEqual({ email: 'noreply@cardbrix.com', name: 'CardBrix' }));
  test('Name <addr> without quotes', () => expect(parseAddress('CardBrix <noreply@cardbrix.com>')).toEqual({ email: 'noreply@cardbrix.com', name: 'CardBrix' }));
  test('bare address', () => expect(parseAddress(' noreply@cardbrix.com ')).toEqual({ email: 'noreply@cardbrix.com' }));
});

describe('sendVerificationEmail with a SendGrid key', () => {
  const ORIGINAL = { ...process.env };
  beforeEach(() => {
    axios.post.mockReset();
    process.env.SENDGRID_API_KEY = 'SG.fake-key-for-tests';
    delete process.env.FROM_EMAIL;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    process.env = { ...ORIGINAL };
    jest.restoreAllMocks();
  });

  test('POSTs to the HTTPS API (not SMTP) with auth, sender, recipient, link and a timeout', async () => {
    axios.post.mockResolvedValue({ status: 202, headers: { 'x-message-id': 'abc' } });
    const { sendVerificationEmail } = loadEmail();

    await expect(sendVerificationEmail('user@example.com', 'https://cardbrix.com/verifica-email?token=t1')).resolves.toBe(true);

    expect(axios.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = axios.post.mock.calls[0];
    expect(url).toBe('https://api.sendgrid.com/v3/mail/send');
    expect(body.personalizations).toEqual([{ to: [{ email: 'user@example.com' }] }]);
    expect(body.from.email).toBe('noreply@cardbrix.com');
    expect(body.from.name).toMatch(/^cardbrix$/i);
    expect(body.subject).toBe('Conferma il tuo indirizzo email - CardBrix');
    expect(body.content.map((c) => c.type)).toEqual(['text/plain', 'text/html']);
    expect(body.content[1].value).toContain('https://cardbrix.com/verifica-email?token=t1');
    expect(config.headers.Authorization).toBe('Bearer SG.fake-key-for-tests');
    expect(config.timeout).toBeGreaterThan(0);
    expect(config.timeout).toBeLessThanOrEqual(15000);
  });

  test('honours FROM_EMAIL', async () => {
    process.env.FROM_EMAIL = '"CardBrix Team" <hello@cardbrix.com>';
    axios.post.mockResolvedValue({ status: 202, headers: {} });
    await loadEmail().sendVerificationEmail('user@example.com', 'https://x/y');
    expect(axios.post.mock.calls[0][1].from).toEqual({ email: 'hello@cardbrix.com', name: 'CardBrix Team' });
  });

  test('a SendGrid rejection (e.g. unverified sender) surfaces a readable error', async () => {
    axios.post.mockRejectedValue({
      response: { status: 403, data: { errors: [{ message: 'The from address does not match a verified Sender Identity.' }] } },
    });
    const { sendVerificationEmail } = loadEmail();
    await expect(sendVerificationEmail('user@example.com', 'https://x/y')).rejects.toThrow(/HTTP 403.*verified Sender Identity/);
  });

  test('a timeout rejects instead of hanging', async () => {
    axios.post.mockRejectedValue({ code: 'ECONNABORTED', message: 'timeout of 10000ms exceeded' });
    await expect(loadEmail().sendVerificationEmail('user@example.com', 'https://x/y')).rejects.toThrow(/non ha risposto entro 10s/);
  });

  test('recovery email goes through the same API path', async () => {
    axios.post.mockResolvedValue({ status: 202, headers: {} });
    await loadEmail().sendRecoveryEmail('user@example.com', 'https://cardbrix.com/reset?t=1');
    expect(axios.post.mock.calls[0][1].content[1].value).toContain('https://cardbrix.com/reset?t=1');
  });
});

describe('verification email content', () => {
  const { verificationEmail, VERIFY_LINK_TTL_HOURS } = require('../src/services/emailTemplates');
  const link = 'https://cardbrix.com/verifica-email?token=abc123';
  const mail = verificationEmail(link);

  test('has subject, plain text and html, all carrying the real link', () => {
    expect(mail.subject).toMatch(/CardBrix/);
    expect(mail.text).toContain(link);
    expect(mail.html).toContain(`href="${link}"`);
  });
  test('html is a complete, mobile-friendly document with a hidden preheader', () => {
    expect(mail.html).toMatch(/^<!doctype html>/i);
    expect(mail.html).toContain('width=device-width');
    expect(mail.html).toContain('display:none');
    expect(mail.html).toContain('max-width:560px');
  });
  test('states the 24h validity (must match the token expiry in authService)', () => {
    expect(VERIFY_LINK_TTL_HOURS).toBe(24);
    expect(mail.text).toContain('24 ore');
    expect(mail.html).toContain('24 ore');
    const src = require('fs').readFileSync(require('path').join(__dirname, '../src/services/authService.js'), 'utf8');
    expect(src).toMatch(/24 \* 3600000/);
  });
  test('product rules: no euro/credit ratio and no hardcoded bonus amount', () => {
    for (const body of [mail.text, mail.html]) {
      expect(body).not.toMatch(/€|euro|EUR/i);
      expect(body).not.toMatch(/\b\d+\s*crediti/i);
      expect(body).not.toMatch(/recesso/i);
    }
    expect(mail.text).toMatch(/bonus di benvenuto in crediti/);
  });
  test('the link is HTML-escaped', () => {
    const evil = verificationEmail('https://x.it/?a=1&b="><script>1</script>');
    expect(evil.html).not.toContain('<script>');
    expect(evil.html).toContain('&amp;b=&quot;&gt;&lt;script&gt;');
  });
});

describe('Reply-To', () => {
  const ORIGINAL = { ...process.env };
  afterEach(() => { process.env = { ...ORIGINAL }; jest.restoreAllMocks(); });

  test('is sent only when REPLY_TO_EMAIL is set', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    process.env.SENDGRID_API_KEY = 'SG.fake-key-for-tests';
    axios.post.mockReset();
    axios.post.mockResolvedValue({ status: 202, headers: {} });

    delete process.env.REPLY_TO_EMAIL;
    await loadEmail().sendVerificationEmail('u@example.com', 'https://x/y');
    expect(axios.post.mock.calls[0][1].reply_to).toBeUndefined();

    process.env.REPLY_TO_EMAIL = 'Luca <luca@example.com>';
    await loadEmail().sendVerificationEmail('u@example.com', 'https://x/y');
    expect(axios.post.mock.calls[1][1].reply_to).toEqual({ email: 'luca@example.com', name: 'Luca' });
  });
});

describe('no SendGrid key', () => {
  const ORIGINAL = { ...process.env };
  afterEach(() => { process.env = { ...ORIGINAL }; jest.restoreAllMocks(); });

  test.each([[undefined], [''], ['tuachiave-segnaposto']])('production fails fast with a clear error (key=%j) and never touches the network', async (key) => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    process.env.NODE_ENV = 'production';
    if (key === undefined) delete process.env.SENDGRID_API_KEY; else process.env.SENDGRID_API_KEY = key;
    axios.post.mockReset();
    const nodemailer = require('nodemailer');
    const spy = jest.spyOn(nodemailer, 'createTestAccount');

    const started = Date.now();
    await expect(loadEmail().sendVerificationEmail('u@example.com', 'https://x/y')).rejects.toThrow(/SENDGRID_API_KEY mancante/);
    expect(Date.now() - started).toBeLessThan(500);
    expect(axios.post).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
  });

  test('outside production the Ethereal fallback is still used', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    process.env.NODE_ENV = 'development';
    delete process.env.SENDGRID_API_KEY;
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'm1' });
    const fakeNodemailer = {
      createTestAccount: jest.fn().mockResolvedValue({ user: 'u', pass: 'p' }),
      createTransport: jest.fn().mockReturnValue({ sendMail }),
      getTestMessageUrl: jest.fn().mockReturnValue('http://preview'),
    };
    jest.resetModules();
    jest.doMock('axios', () => axios);
    jest.doMock('nodemailer', () => fakeNodemailer);
    const { sendVerificationEmail } = require('../src/services/email');
    await expect(sendVerificationEmail('u@example.com', 'https://x/y')).resolves.toBe(true);
    expect(sendMail).toHaveBeenCalledTimes(1);
    jest.dontMock('nodemailer');
  });
});

describe('no key: the error says why (never the key itself)', () => {
  const ORIGINAL = { ...process.env };
  afterEach(() => { process.env = { ...ORIGINAL }; jest.restoreAllMocks(); });
  const run = async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    process.env.NODE_ENV = 'production';
    try { await loadEmail().sendVerificationEmail('u@example.com', 'https://x/y'); } catch (e) { return e.message; }
    throw new Error('expected a rejection');
  };

  test('variable not found, with a look-alike name listed', async () => {
    delete process.env.SENDGRID_API_KEY;
    process.env['SENDGRID_API_KEY '] = 'SG.secret-value-must-not-leak';
    const msg = await run();
    expect(msg).toMatch(/non trovata/);
    expect(msg).toContain('"SENDGRID_API_KEY "');
    expect(msg).not.toContain('secret-value-must-not-leak');
  });
  test('variable not found, nothing similar', async () => {
    delete process.env.SENDGRID_API_KEY;
    for (const k of Object.keys(process.env)) if (/send|grid/i.test(k)) delete process.env[k];
    expect(await run()).toMatch(/non trovata$|non trovata\./);
  });
  test('empty / whitespace-only', async () => {
    process.env.SENDGRID_API_KEY = '   \n';
    expect(await run()).toMatch(/presente ma vuota/);
  });
  test('placeholder', async () => {
    process.env.SENDGRID_API_KEY = 'tuachiave-qui';
    const msg = await run();
    expect(msg).toMatch(/segnaposto "tuachiave"/);
    expect(msg).not.toContain('tuachiave-qui');
  });
  test('a key pasted with surrounding whitespace/newline is trimmed before use', async () => {
    process.env.SENDGRID_API_KEY = '  SG.fake-key-for-tests\n';
    axios.post.mockReset();
    axios.post.mockResolvedValue({ status: 202, headers: {} });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    await loadEmail().sendVerificationEmail('u@example.com', 'https://x/y');
    expect(axios.post.mock.calls[0][2].headers.Authorization).toBe('Bearer SG.fake-key-for-tests');
  });
});

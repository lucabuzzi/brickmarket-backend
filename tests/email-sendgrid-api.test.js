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
    expect(body.from).toEqual({ email: 'noreply@cardbrix.com', name: 'CardBrix' });
    expect(body.subject).toContain('Verifica');
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

// requestPasswordReset must tell the caller when no account matches the email
// (404 AuthError) and must not store a token or send mail in that case.
// Pure unit test: repository and mailer are mocked, no DB needed.
jest.mock('../src/db', () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock('../src/db/clutchvault-db', () => ({ query: jest.fn(), getClient: jest.fn(), isMock: true }));
jest.mock('../src/repositories/userRepository', () => ({
  findByEmail: jest.fn(),
  setResetToken: jest.fn(),
}));
jest.mock('../src/integrations/email', () => ({
  sendRecoveryEmail: jest.fn(),
  sendVerificationEmail: jest.fn(),
}));

const userRepository = require('../src/repositories/userRepository');
const { sendRecoveryEmail } = require('../src/integrations/email');
const authService = require('../src/services/authService');

beforeEach(() => jest.clearAllMocks());

test('unknown email -> AuthError 404, no token stored, no mail sent', async () => {
  userRepository.findByEmail.mockResolvedValue(null);
  await expect(authService.requestPasswordReset('nobody@example.com')).rejects.toMatchObject({
    status: 404,
  });
  await expect(authService.requestPasswordReset('nobody@example.com')).rejects.toBeInstanceOf(authService.AuthError);
  expect(userRepository.setResetToken).not.toHaveBeenCalled();
  expect(sendRecoveryEmail).not.toHaveBeenCalled();
});

test('existing email -> token stored and recovery mail sent', async () => {
  userRepository.findByEmail.mockResolvedValue({ id: 1, is_active: true });
  await authService.requestPasswordReset('Me@Example.com');
  expect(userRepository.setResetToken).toHaveBeenCalledTimes(1);
  expect(sendRecoveryEmail).toHaveBeenCalledWith('me@example.com', expect.stringContaining('/reset-password?token='));
});

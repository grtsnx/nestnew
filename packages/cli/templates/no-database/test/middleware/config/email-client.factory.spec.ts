import { ConfigService } from '@nestjs/config';

import { emailClientConfigFixtures } from '../../fixtures';
import { createEmailClientFromConfig, getEmailProvider } from 'src/middleware';

function createConfigService(values: Record<string, string>): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('email-client.factory', () => {
  it('resolves supported providers', () => {
    expect(
      getEmailProvider(createConfigService(emailClientConfigFixtures.test)),
    ).toBe('test');
    expect(
      getEmailProvider(createConfigService(emailClientConfigFixtures.google)),
    ).toBe('google');
    expect(
      getEmailProvider(createConfigService(emailClientConfigFixtures.smtp)),
    ).toBe('smtp');
    expect(
      getEmailProvider(createConfigService(emailClientConfigFixtures.resend)),
    ).toBe('resend');
  });

  it('throws for invalid email provider', () => {
    expect(() =>
      getEmailProvider(
        createConfigService(emailClientConfigFixtures.invalidProvider),
      ),
    ).toThrow('EMAIL_PROVIDER must be one of');
  });

  it('sends via memory adapter when EMAIL_PROVIDER=test', async () => {
    const client = await createEmailClientFromConfig(
      createConfigService(emailClientConfigFixtures.test),
    );

    const result = await client.send({
      from: 'TestPlatform <noreply@test.local>',
      to: 'alex@example.com',
      subject: 'Welcome',
      html: '<p>hi</p>',
      text: 'hi',
    });

    expect(result.adapter).toBe('memory');
  });

  it('constructs google, smtp, and resend clients without sending', async () => {
    const googleClient = await createEmailClientFromConfig(
      createConfigService(emailClientConfigFixtures.google),
    );
    const smtpClient = await createEmailClientFromConfig(
      createConfigService(emailClientConfigFixtures.smtp),
    );
    const resendClient = await createEmailClientFromConfig(
      createConfigService(emailClientConfigFixtures.resend),
    );

    expect(typeof googleClient.send).toBe('function');
    expect(typeof smtpClient.send).toBe('function');
    expect(typeof resendClient.send).toBe('function');
  });
});

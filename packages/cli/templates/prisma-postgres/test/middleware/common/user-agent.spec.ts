import {
  enrichSessionClient,
  parseClientUserAgent,
} from 'src/middleware';

describe('parseClientUserAgent', () => {
  it('parses Opera on macOS with version and architecture', () => {
    expect(
      parseClientUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 OPR/133.0.0.0',
      ),
    ).toEqual({
      browser: 'Opera',
      browserVersion: '133.0.0.0',
      platform: 'macOS',
      platformVersion: '10.15.7',
      architecture: 'Intel',
      device: 'desktop',
      deviceName: 'Mac',
      userAgent: 'Opera 133 on macOS Catalina',
    });
  });

  it('parses curl as an API client with version', () => {
    expect(parseClientUserAgent('curl/8.21.0')).toEqual({
      browser: 'curl',
      browserVersion: '8.21.0',
      platform: 'Unknown platform',
      platformVersion: null,
      architecture: null,
      device: 'api',
      deviceName: 'API client',
      userAgent: 'curl 8',
    });
  });

  it('enriches session payloads and marks the current session', () => {
    expect(
      enrichSessionClient(
        {
          id: 'sess_1',
          token: 'current-token',
          userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
        },
        'current-token',
      ),
    ).toMatchObject({
      browser: 'Edge',
      browserVersion: '120.0.0.0',
      platform: 'Windows',
      platformVersion: '10',
      architecture: 'Intel',
      device: 'desktop',
      deviceName: 'Windows PC',
      userAgent: 'Edge 120 on Windows 10',
      current: true,
    });
  });
});

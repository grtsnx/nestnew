export type ClientDeviceType =
  | 'mobile'
  | 'tablet'
  | 'desktop'
  | 'bot'
  | 'api'
  | 'unknown';

export type ParsedClientUserAgent = {
  browser: string;
  browserVersion: string | null;
  platform: string;
  platformVersion: string | null;
  architecture: string | null;
  device: ClientDeviceType;
  deviceName: string;
  userAgent: string;
};

const API_CLIENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^curl\/([\d.]+)/i, 'curl'],
  [/^postmanruntime\/([\d.]+)/i, 'Postman'],
  [/^insomnia\/([\d.]+)/i, 'Insomnia'],
  [/^httpie\/([\d.]+)/i, 'HTTPie'],
  [/^axios\/([\d.]+)/i, 'Axios'],
  [/^node-fetch\/([\d.]+)/i, 'Node fetch'],
  [/^undici\/([\d.]+)/i, 'Undici'],
  [/^python-requests\/([\d.]+)/i, 'Python requests'],
  [/^okhttp\/([\d.]+)/i, 'OkHttp'],
  [/^go-http-client\/([\d.]+)/i, 'Go HTTP client'],
];

const MACOS_RELEASES: ReadonlyArray<readonly [number, number, string]> = [
  [16, 0, 'Tahoe'],
  [15, 0, 'Sequoia'],
  [14, 0, 'Sonoma'],
  [13, 0, 'Ventura'],
  [12, 0, 'Monterey'],
  [11, 0, 'Big Sur'],
  [10, 15, 'Catalina'],
  [10, 14, 'Mojave'],
  [10, 13, 'High Sierra'],
];

const WINDOWS_RELEASES: Readonly<Record<string, string>> = {
  '10.0': '10',
  '6.3': '8.1',
  '6.2': '8',
  '6.1': '7',
};

function majorVersion(version: string | null): string | null {
  if (!version) {
    return null;
  }
  const major = version.split('.')[0];
  return major && major.length > 0 ? major : version;
}

function detectDevice(raw: string): ClientDeviceType {
  const lower = raw.toLowerCase();
  if (/bot|crawl|spider|slurp|bingpreview|headlesschrome/.test(lower)) {
    return 'bot';
  }
  if (/ipad|tablet/.test(lower)) {
    return 'tablet';
  }
  if (/mobi|iphone|android/.test(lower)) {
    return 'mobile';
  }
  if (raw.length > 0) {
    return 'desktop';
  }
  return 'unknown';
}

function detectApiClient(
  raw: string,
): { name: string; version: string | null } | undefined {
  for (const [pattern, name] of API_CLIENTS) {
    const match = raw.match(pattern);
    if (match) {
      return { name, version: match[1] ?? null };
    }
  }
  return undefined;
}

function detectBrowser(raw: string): { name: string; version: string | null } {
  const matchers: ReadonlyArray<readonly [RegExp, string]> = [
    [/edg(?:e|a|ios)?\/([\d.]+)/i, 'Edge'],
    [/opr\/([\d.]+)/i, 'Opera'],
    [/opt\/([\d.]+)/i, 'Opera'],
    [/firefox\/([\d.]+)/i, 'Firefox'],
    [/crios\/([\d.]+)/i, 'Chrome'],
    [/chrome\/([\d.]+)/i, 'Chrome'],
    [/version\/([\d.]+).*safari/i, 'Safari'],
    [/safari\/([\d.]+)/i, 'Safari'],
  ];

  for (const [pattern, name] of matchers) {
    const match = raw.match(pattern);
    if (match) {
      return { name, version: match[1] ?? null };
    }
  }

  return { name: 'Unknown browser', version: null };
}

function macosRelease(version: string | null): string | null {
  if (!version) {
    return null;
  }
  const [majorRaw, minorRaw] = version.split('.');
  const major = Number(majorRaw);
  const minor = Number(minorRaw ?? '0');
  if (!Number.isFinite(major)) {
    return null;
  }
  for (const [releaseMajor, releaseMinor, name] of MACOS_RELEASES) {
    if (
      major > releaseMajor ||
      (major === releaseMajor && minor >= releaseMinor)
    ) {
      return name;
    }
  }
  return null;
}

function detectPlatform(raw: string): {
  name: string;
  version: string | null;
} {
  if (/windows nt/i.test(raw)) {
    const match = raw.match(/windows nt ([\d.]+)/i);
    const nt = match?.[1] ?? null;
    if (/windows 11/i.test(raw)) {
      return { name: 'Windows', version: '11' };
    }
    return { name: 'Windows', version: nt ? (WINDOWS_RELEASES[nt] ?? nt) : null };
  }
  if (/mac os x/i.test(raw) && !/iphone|ipad|ipod/i.test(raw)) {
    const match = raw.match(/mac os x ([\d_]+)/i);
    const version = match?.[1]?.replace(/_/g, '.') ?? null;
    return { name: 'macOS', version };
  }
  if (/iphone|ipad|ipod/i.test(raw)) {
    const match = raw.match(/os ([\d_]+)/i);
    return {
      name: 'iOS',
      version: match?.[1]?.replace(/_/g, '.') ?? null,
    };
  }
  if (/android/i.test(raw)) {
    const match = raw.match(/android ([\d.]+)/i);
    return { name: 'Android', version: match?.[1] ?? null };
  }
  if (/cros/i.test(raw)) {
    return { name: 'ChromeOS', version: null };
  }
  if (/linux/i.test(raw)) {
    return { name: 'Linux', version: null };
  }
  return { name: 'Unknown platform', version: null };
}

function detectArchitecture(raw: string): string | null {
  if (/arm64|aarch64|apple silicon/i.test(raw)) {
    return 'ARM';
  }
  if (/intel mac|win64|x64|x86_64|amd64/i.test(raw)) {
    return 'Intel';
  }
  if (/wow64|win32|i686|i386/i.test(raw)) {
    return '32-bit';
  }
  return null;
}

function detectDeviceName(
  raw: string,
  platform: string,
  device: ClientDeviceType,
): string {
  if (/ipad/i.test(raw)) {
    return 'iPad';
  }
  if (/iphone/i.test(raw)) {
    return 'iPhone';
  }
  if (/ipod/i.test(raw)) {
    return 'iPod';
  }
  if (platform === 'macOS') {
    return 'Mac';
  }
  if (platform === 'Windows') {
    return 'Windows PC';
  }
  if (platform === 'Android' && device === 'mobile') {
    return 'Android phone';
  }
  if (platform === 'Android' && device === 'tablet') {
    return 'Android tablet';
  }
  if (device === 'api') {
    return 'API client';
  }
  if (device === 'bot') {
    return 'Bot';
  }
  if (device === 'desktop') {
    return 'Desktop';
  }
  if (device === 'mobile') {
    return 'Phone';
  }
  if (device === 'tablet') {
    return 'Tablet';
  }
  return 'Unknown device';
}

function withVersion(name: string, version: string | null): string {
  const major = majorVersion(version);
  return major ? `${name} ${major}` : name;
}

function friendlyLabel(parsed: {
  browser: string;
  browserVersion: string | null;
  platform: string;
  platformVersion: string | null;
  macosName: string | null;
  device: ClientDeviceType;
}): string {
  const browser = withVersion(parsed.browser, parsed.browserVersion);
  if (parsed.device === 'api' || parsed.platform === 'Unknown platform') {
    return browser;
  }
  if (parsed.platform === 'macOS' && parsed.macosName) {
    return `${browser} on macOS ${parsed.macosName}`;
  }
  if (parsed.platformVersion) {
    return `${browser} on ${parsed.platform} ${majorVersion(parsed.platformVersion)}`;
  }
  return `${browser} on ${parsed.platform}`;
}

/** Turn a stored request user-agent into UI-friendly client labels. */
export function parseClientUserAgent(
  raw: string | null | undefined,
): ParsedClientUserAgent {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) {
    return {
      browser: 'Unknown browser',
      browserVersion: null,
      platform: 'Unknown platform',
      platformVersion: null,
      architecture: null,
      device: 'unknown',
      deviceName: 'Unknown device',
      userAgent: 'Unknown browser',
    };
  }

  const apiClient = detectApiClient(trimmed);
  const device = apiClient ? 'api' : detectDevice(trimmed);
  const platform = detectPlatform(trimmed);
  const browser = apiClient
    ? { name: apiClient.name, version: apiClient.version }
    : detectBrowser(trimmed);
  const macosName =
    platform.name === 'macOS' ? macosRelease(platform.version) : null;
  const parsed = {
    browser: browser.name,
    browserVersion: browser.version,
    platform: platform.name,
    platformVersion: platform.version,
    architecture: detectArchitecture(trimmed),
    device,
    deviceName: detectDeviceName(trimmed, platform.name, device),
    userAgent: '',
  };
  parsed.userAgent = friendlyLabel({
    ...parsed,
    macosName,
  });
  return parsed;
}

export function enrichSessionClient<T extends Record<string, unknown>>(
  session: T,
  currentToken?: string,
): T & ParsedClientUserAgent & { current: boolean } {
  const parsed = parseClientUserAgent(
    typeof session.userAgent === 'string' ? session.userAgent : undefined,
  );
  const token = typeof session.token === 'string' ? session.token : undefined;
  return {
    ...session,
    ...parsed,
    current: Boolean(currentToken && token && currentToken === token),
  };
}

export function enrichSessionClients(
  sessions: ReadonlyArray<Record<string, unknown>>,
  currentToken?: string,
): Array<Record<string, unknown>> {
  return sessions.map((session) => enrichSessionClient(session, currentToken));
}

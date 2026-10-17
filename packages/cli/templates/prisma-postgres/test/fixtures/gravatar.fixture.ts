export const gravatarEmailFixtures = {
  standard: 'user@example.com',
  protocolRelative: 'another@example.com',
  bareHost: 'bare@example.com',
} as const;

export const gravatarCustomOptions = {
  size: '80',
  rating: 'g' as const,
  default: 'retro' as const,
};

/** ensureHttpsUrl normalization edge cases. */
export const urlNormalizationFixtures = {
  http: {
    input: 'http://example.com/avatar',
    expected: 'https://example.com/avatar',
  },
  protocolRelative: {
    input: '//cdn.example.com/img',
    expected: 'https://cdn.example.com/img',
  },
  bareHost: {
    input: 'cdn.example.com/img',
    expected: 'https://cdn.example.com/img',
  },
  https: {
    input: 'https://example.com/avatar',
    expected: 'https://example.com/avatar',
  },
} as const;

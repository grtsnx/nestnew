process.env.EMAIL_PROVIDER ??= 'test';
process.env.PLATFORM_SUPPORT ??= 'noreply@test.local';
process.env.COLOR_CODE ??= '#635BFF';
process.env.PROCESS_ROLE ??= 'api';

// Keep REDIS_URL when CI/local provides it (happy-path readiness).
if (!process.env.REDIS_URL?.trim()) {
  delete process.env.REDIS_URL;
}

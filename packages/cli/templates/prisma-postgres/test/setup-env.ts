process.env.EMAIL_PROVIDER ??= 'test';
process.env.PLATFORM_NAME ??= 'TestPlatform';
process.env.PLATFORM_SUPPORT ??= 'noreply@test.local';
process.env.COLOR_CODE ??= '#635BFF';
process.env.DATABASE_URL ??=
  'postgresql://postgres:postgres@127.0.0.1:5432/builder_test?sslmode=disable';
process.env.BETTER_AUTH_SECRET ??= 'test-secret-at-least-32-characters-long!!';
process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
delete process.env.REDIS_URL;

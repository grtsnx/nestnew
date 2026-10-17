process.env.EMAIL_PROVIDER ??= 'test';
process.env.PLATFORM_NAME ??= 'TestPlatform';
process.env.PLATFORM_SUPPORT ??= 'noreply@test.local';
process.env.COLOR_CODE ??= '#635BFF';
delete process.env.REDIS_URL;

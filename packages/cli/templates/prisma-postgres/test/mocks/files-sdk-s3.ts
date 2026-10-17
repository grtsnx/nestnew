export const mockS3 = jest.fn((opts: unknown) => ({ name: 's3', opts }));

export const s3 = (opts: unknown) => mockS3(opts);

export function resetS3Mock(): void {
  mockS3.mockClear();
}

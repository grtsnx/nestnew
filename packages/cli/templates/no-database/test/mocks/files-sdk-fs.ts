export const mockFs = jest.fn((opts: unknown) => ({ name: 'fs', opts }));

export const fs = (opts: unknown) => mockFs(opts);

export function resetFsMock(): void {
  mockFs.mockClear();
}

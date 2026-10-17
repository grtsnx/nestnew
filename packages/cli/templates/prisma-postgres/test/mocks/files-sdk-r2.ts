export const mockR2 = jest.fn((opts: unknown) => ({ name: 'r2', opts }));

export const r2 = (opts: unknown) => mockR2(opts);

export function resetR2Mock(): void {
  mockR2.mockClear();
}

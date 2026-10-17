import { Autumn } from 'autumn-js';

let client: Autumn | null = null;

export function getAutumnClient(): Autumn | null {
  const key = process.env.AUTUMN_SECRET_KEY?.trim();
  if (!key) {
    return null;
  }
  if (!client) {
    client = new Autumn({ secretKey: key });
  }
  return client;
}

export function requireAutumnClient(): Autumn {
  const autumn = getAutumnClient();
  if (!autumn) {
    throw new Error('AUTUMN_SECRET_KEY is not configured');
  }
  return autumn;
}

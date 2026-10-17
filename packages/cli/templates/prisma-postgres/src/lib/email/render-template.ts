import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import Handlebars from 'handlebars';

const templatesDir = join(__dirname, 'templates');

const handlebars = Handlebars.create();
handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);

export function renderEmailTemplate(
  template: string,
  context: Record<string, unknown>,
): string {
  if (!/^[A-Za-z0-9_-]+$/.test(template)) {
    throw new Error(`Unknown email template: ${template}`);
  }

  const filePath = join(templatesDir, `${template}.hbs`);
  let source: string;
  try {
    source = readFileSync(filePath, 'utf8');
  } catch {
    throw new Error(`Unknown email template: ${template}`);
  }

  const compiled = handlebars.compile(source, { strict: true });
  return compiled(context);
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<a [^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

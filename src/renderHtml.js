import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = join(__dirname, '..', 'template', 'post.html');

export function renderHtml({ verse, original, source, photoUrl }) {
  const template = readFileSync(TEMPLATE_PATH, 'utf-8');

  return template
    .replace('{{verse}}', verse)
    .replace('{{original}}', original ?? '')
    .replace('{{originalHidden}}', original ? '' : 'hidden')
    .replace('{{source}}', source)
    .replace('{{photoUrl}}', photoUrl);
}

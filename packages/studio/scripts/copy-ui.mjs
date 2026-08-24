import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, '../src/ui');
const dest = join(__dirname, '../dist/ui');

mkdirSync(dest, { recursive: true });
copyFileSync(join(src, 'index.html'), join(dest, 'index.html'));
copyFileSync(join(src, 'style.css'), join(dest, 'style.css'));

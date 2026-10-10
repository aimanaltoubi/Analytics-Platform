import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const targets = ['src', 'server', 'dist'];
const extensions = new Set(['.js', '.jsx', '.html', '.css', '.json']);
const forbidden = [
  ['retired hosted SDK', /@retired-hosted-sdk|api\.legacy|app\.legacy/i],
  ['remote asset host', /(?:fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net|unpkg\.com|esm\.sh)/i],
  ['remote WebSocket', /\bwss?:\/\//i]
];
const failures = [];

function visit(path) {
  const stat = statSync(path);
  if (stat.isDirectory()) {
    for (const name of readdirSync(path)) {
      if (name === 'tests' || name.endsWith('.test.js')) continue;
      visit(join(path, name));
    }
    return;
  }
  if (!extensions.has(extname(path))) return;
  const content = readFileSync(path, 'utf8');
  for (const [label, pattern] of forbidden) {
    if (pattern.test(content)) failures.push(`${relative(root, path)} contains ${label}`);
  }
}

for (const target of targets) visit(join(root, target));
if (failures.length) {
  console.error(`Offline validation failed:\n- ${failures.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('Offline validation passed: no retired hosted SDK or known remote asset endpoints were found.');
}

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const excludedDirectories = new Set(['.git', 'node_modules', 'dist', 'release']);
const retiredPlatform = ['base', '[\\s_-]*', '44'].join('');
const forbidden = [
  ['prohibited platform reference', new RegExp(retiredPlatform, 'i')],
  ['remote asset host', /(?:fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net|unpkg\.com|esm\.sh)/i],
  ['remote WebSocket', /\bwss?:\/\//i]
];
const failures = [];

function visit(path) {
  const stat = statSync(path);
  if (stat.isDirectory()) {
    if (path !== root && excludedDirectories.has(basename(path))) return;
    for (const name of readdirSync(path)) {
      visit(join(path, name));
    }
    return;
  }
  if (!stat.isFile() || stat.size > 5 * 1024 * 1024) return;

  const relativePath = relative(root, path);
  if (new RegExp(retiredPlatform, 'i').test(relativePath)) {
    failures.push(`${relativePath} contains a prohibited platform reference in its path`);
  }

  const content = readFileSync(path, 'utf8');
  for (const [label, pattern] of forbidden) {
    if (pattern.test(content)) failures.push(`${relativePath} contains ${label}`);
  }
}

visit(root);
if (failures.length) {
  console.error(`Offline validation failed:\n- ${failures.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('Offline validation passed: no prohibited platform references or known remote asset endpoints were found.');
}

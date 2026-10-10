import { copyFileSync, existsSync, linkSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const sourceDirectory = resolve('resources/ai');
const outputDirectory = resolve('release');
const models = readdirSync(sourceDirectory).filter((name) => name.toLowerCase().endsWith('.gguf'));
if (models.length !== 1) {
  console.error(`Expected exactly one GGUF model in resources/ai; found ${models.length}.`);
  process.exit(1);
}

mkdirSync(outputDirectory, { recursive: true });
const source = join(sourceDirectory, models[0]);
const destination = join(outputDirectory, basename(source));
if (existsSync(destination)) rmSync(destination);
try {
  linkSync(source, destination);
  console.log(`Staged model sidecar using a hard link: ${destination}`);
} catch (error) {
  if (!['EXDEV', 'EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) throw error;
  copyFileSync(source, destination);
  console.log(`Staged model sidecar using a copy: ${destination}`);
}

import { closeSync, lstatSync, openSync, readFileSync, readSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const runtimeDirectory = resolve('release/win-unpacked/resources/ai');
const modelDirectory = resolve('resources/ai');
const installerScript = resolve('build/installer.nsh');
const requiredRuntime = [
  'llama-server.exe',
  'llama-server-impl.dll',
  'llama-common.dll',
  'llama.dll',
  'ggml.dll',
  'ggml-base.dll',
  'ggml-cpu-x64.dll',
  'libomp.dll'
];

function regularFile(path) {
  try {
    const stat = lstatSync(path);
    return stat.isFile() && !stat.isSymbolicLink();
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function signature(path, length) {
  const descriptor = openSync(path, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const bytesRead = readSync(descriptor, buffer, 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    closeSync(descriptor);
  }
}

export function checkPackagedAi(runtimePath = runtimeDirectory, modelPath = modelDirectory, installerPath = installerScript) {
  const errors = requiredRuntime
    .filter((name) => !regularFile(join(runtimePath, name)))
    .map((name) => `packaged AI runtime is missing ${name}`);
  const stagedModels = readdirSync(runtimePath).filter((name) => name.toLowerCase().endsWith('.gguf'));
  if (stagedModels.length) errors.push('the staged app must exclude GGUF files to avoid an extra model copy');

  const models = readdirSync(modelPath).filter((name) => name.toLowerCase().endsWith('.gguf') && regularFile(join(modelPath, name)));
  if (models.length !== 1) {
    errors.push(`expected exactly one source GGUF model; found ${models.length}`);
  } else {
    const modelFile = join(modelPath, models[0]);
    if (statSync(modelFile).size < 1_000_000 || signature(modelFile, 4).toString('ascii') !== 'GGUF') {
      errors.push(`source model ${models[0]} is not a valid GGUF file`);
    }
  }

  for (const name of ['LICENSE-llama.cpp', 'LICENSE-Qwen2.5', 'THIRD_PARTY_NOTICES.txt']) {
    if (!regularFile(join(runtimePath, name))) errors.push(`packaged AI resources are missing ${name}`);
  }
  const installerContents = readFileSync(installerPath, 'utf8');
  if (!installerContents.includes('IfFileExists "$EXEDIR\\Qwen2.5-14B-Instruct-Q4_K_M.gguf"') || !installerContents.includes('CopyFiles /SILENT "$EXEDIR\\Qwen2.5-14B-Instruct-Q4_K_M.gguf" "$INSTDIR\\resources\\ai"')) {
    errors.push('the installer must copy the adjacent GGUF model into the installed resources/ai directory');
  }

  return { errors, model: models.length === 1 ? models[0] : null };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { errors, model } = checkPackagedAi();
  if (errors.length) {
    console.error(`Cannot create the offline installer:\n- ${errors.join('\n- ')}`);
    process.exitCode = 1;
  } else {
    console.log(`Packaged AI payload ready: llama.cpp runtime will be installed; ${model} will be copied from beside the installer.`);
  }
}
import { closeSync, lstatSync, openSync, readSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const directory = resolve('resources/ai');
const errors = [];
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

for (const name of requiredRuntime) {
  if (!regularFile(join(directory, name))) errors.push(`resources/ai/${name} is missing`);
}
const executable = join(directory, 'llama-server.exe');
if (regularFile(executable) && !signature(executable, 2).equals(Buffer.from('MZ'))) {
  errors.push('resources/ai/llama-server.exe is not a Windows executable');
}

let models = [];
try {
  models = readdirSync(directory).filter((name) => name.toLowerCase().endsWith('.gguf') && regularFile(join(directory, name)));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (!models.length) {
  errors.push('resources/ai must contain a .gguf model');
} else {
  for (const name of models) {
    const path = join(directory, name);
    if (statSync(path).size < 1_000_000 || signature(path, 4).toString('ascii') !== 'GGUF') {
      errors.push(`resources/ai/${name} is not a valid GGUF model`);
    }
  }
}
for (const name of ['LICENSE-llama.cpp', 'LICENSE-Qwen2.5', 'THIRD_PARTY_NOTICES.txt']) {
  if (!regularFile(join(directory, name))) errors.push(`resources/ai/${name} is missing`);
}

if (errors.length) {
  console.error(`Windows AI resources are incomplete:\n- ${errors.join('\n- ')}\n\nAdd the complete Windows llama.cpp CPU runtime, its licenses, and one GGUF instruct model before packaging.`);
  process.exitCode = 1;
} else {
  console.log(`AI resources ready: complete llama.cpp runtime and ${models.length} GGUF model(s).`);
}

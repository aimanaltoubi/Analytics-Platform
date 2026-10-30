import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkPackagedAi } from '../scripts/check-packaged-ai.js';

const runtimeFiles = [
  'llama-server.exe',
  'llama-server-impl.dll',
  'llama-common.dll',
  'llama.dll',
  'ggml.dll',
  'ggml-base.dll',
  'ggml-cpu-x64.dll',
  'libomp.dll',
  'LICENSE-llama.cpp',
  'LICENSE-Qwen2.5',
  'THIRD_PARTY_NOTICES.txt'
];

test('packaging check requires runtime files and exactly one valid source model', () => {
  const root = mkdtempSync(join(tmpdir(), 'analytics-package-'));
  const runtime = join(root, 'runtime');
  const model = join(root, 'model');
  const installer = join(root, 'installer.iss');
  mkdirSync(runtime);
  mkdirSync(model);
  try {
    for (const name of runtimeFiles) writeFileSync(join(runtime, name), name.endsWith('.exe') ? 'MZ' : 'runtime');
    writeFileSync(join(model, 'model.gguf'), Buffer.concat([Buffer.from('GGUF'), Buffer.alloc(1_000_000)]));
    writeFileSync(installer, 'IfFileExists "$EXEDIR\\Qwen2.5-14B-Instruct-Q4_K_M.gguf" model_found model_missing\nCopyFiles /SILENT "$EXEDIR\\Qwen2.5-14B-Instruct-Q4_K_M.gguf" "$INSTDIR\\resources\\ai"');
    assert.deepEqual(checkPackagedAi(runtime, model, installer), { errors: [], model: 'model.gguf' });

    writeFileSync(join(runtime, 'duplicate.gguf'), 'model');
    assert.match(checkPackagedAi(runtime, model, installer).errors.join('\n'), /exclude GGUF/);
    rmSync(join(runtime, 'duplicate.gguf'));

    writeFileSync(join(model, 'invalid.gguf'), 'not GGUF');
    assert.match(checkPackagedAi(runtime, model, installer).errors.join('\n'), /exactly one source GGUF/);

    writeFileSync(installer, 'no model source');
    assert.match(checkPackagedAi(runtime, model, installer).errors.join('\n'), /copy the adjacent GGUF/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

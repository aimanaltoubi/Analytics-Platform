import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findAiBundle, launchAiServer, reserveLoopbackPort } from './runtime.js';

test('findAiBundle requires a regular platform server and chooses a stable GGUF model', () => {
  const directory = mkdtempSync(join(tmpdir(), 'analytics-ai-'));
  try {
    assert.equal(findAiBundle(directory, 'win32'), null);
    writeFileSync(join(directory, 'llama-server.exe'), 'binary');
    assert.equal(findAiBundle(directory, 'win32'), null);
    writeFileSync(join(directory, 'z-model.gguf'), 'model');
    writeFileSync(join(directory, 'a-model.gguf'), 'model');
    assert.deepEqual(findAiBundle(directory, 'win32'), {
      directory,
      executable: join(directory, 'llama-server.exe'),
      model: join(directory, 'a-model.gguf')
    });
    symlinkSync(join(directory, 'a-model.gguf'), join(directory, '0-model.gguf'));
    assert.equal(findAiBundle(directory, 'linux'), null);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('findAiBundle can load a model sidecar from beside the packaged executable', () => {
  const runtimeDirectory = mkdtempSync(join(tmpdir(), 'analytics-runtime-'));
  const modelDirectory = mkdtempSync(join(tmpdir(), 'analytics-model-'));
  try {
    writeFileSync(join(runtimeDirectory, 'llama-server.exe'), 'binary');
    writeFileSync(join(modelDirectory, 'model.gguf'), 'model');
    assert.deepEqual(findAiBundle(runtimeDirectory, 'win32', [runtimeDirectory, modelDirectory]), {
      directory: runtimeDirectory,
      executable: join(runtimeDirectory, 'llama-server.exe'),
      model: join(modelDirectory, 'model.gguf')
    });
  } finally {
    rmSync(runtimeDirectory, { recursive: true, force: true });
    rmSync(modelDirectory, { recursive: true, force: true });
  }
});

test('reserveLoopbackPort returns an available TCP port', async () => {
  const port = await reserveLoopbackPort();
  assert.equal(Number.isInteger(port), true);
  assert.equal(port > 0 && port <= 65535, true);
});

test('launchAiServer passes loopback-only arguments to the bundled process', () => {
  let call;
  const stream = { on() {} };
  const fakeChild = { stdout: stream, stderr: stream };
  const bundle = { directory: '/bundle', executable: '/bundle/llama-server', model: '/bundle/model.gguf' };
  const result = launchAiServer(bundle, 49152, (...args) => {
    call = args;
    return fakeChild;
  });
  assert.equal(result, fakeChild);
  assert.deepEqual(call, [
    bundle.executable,
    ['--model', bundle.model, '--host', '127.0.0.1', '--port', '49152', '--ctx-size', '8192', '--jinja'],
    { cwd: bundle.directory, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
  ]);
});

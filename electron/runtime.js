import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { lstatSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function regularFile(path) {
  try {
    const stat = lstatSync(path);
    return stat.isFile() && !stat.isSymbolicLink();
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

export function findAiBundle(directory, platform = process.platform, modelDirectories = [directory]) {
  const executableName = platform === 'win32' ? 'llama-server.exe' : 'llama-server';
  const executable = join(directory, executableName);
  if (!regularFile(executable)) return null;

  const models = [];
  for (const modelDirectory of modelDirectories) {
    if (!modelDirectory) continue;
    try {
      for (const name of readdirSync(modelDirectory)) {
        if (name.toLowerCase().endsWith('.gguf') && regularFile(join(modelDirectory, name))) {
          models.push(join(modelDirectory, name));
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  models.sort();
  if (!models.length) return null;
  return { directory, executable, model: models[0] };
}

export async function reserveLoopbackPort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

export function launchAiServer(bundle, port, spawnProcess = spawn) {
  const child = spawnProcess(bundle.executable, [
    '--model', bundle.model,
    '--host', '127.0.0.1',
    '--port', String(port),
    '--ctx-size', '8192',
    '--jinja'
  ], {
    cwd: bundle.directory,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout?.on('data', (chunk) => console.log(`[local-ai] ${String(chunk).trimEnd()}`));
  child.stderr?.on('data', (chunk) => console.error(`[local-ai] ${String(chunk).trimEnd()}`));
  return child;
}

export async function stopChild(child, timeoutMs = 5000) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }, timeoutMs);
    timeout.unref();
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
    if (!child.kill('SIGTERM')) {
      clearTimeout(timeout);
      resolve();
    }
  });
}

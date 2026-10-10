import { app, BrowserWindow, dialog, session } from 'electron';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { startServer } from '../server/index.js';
import { findAiBundle, launchAiServer, reserveLoopbackPort, stopChild } from './runtime.js';

let mainWindow;
let localServer;
let aiProcess;
let shuttingDown = false;

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();

function aiDirectory() {
  if (process.env.LOCAL_AI_DIR) return process.env.LOCAL_AI_DIR;
  return app.isPackaged
    ? join(process.resourcesPath, 'ai')
    : join(app.getAppPath(), 'resources', 'ai');
}

async function createWindow() {
  const runtimeDirectory = aiDirectory();
  const bundle = findAiBundle(runtimeDirectory, process.platform, [
    runtimeDirectory,
    process.env.LOCAL_AI_MODEL_DIR,
    app.isPackaged ? dirname(process.execPath) : undefined
  ]);
  let aiBaseUrl = 'http://127.0.0.1:1';
  if (bundle) {
    const port = await reserveLoopbackPort();
    aiBaseUrl = `http://127.0.0.1:${port}`;
    aiProcess = launchAiServer(bundle, port);
    aiProcess.once('error', (error) => console.error('Could not start the local AI server:', error));
    aiProcess.once('exit', (code, signal) => {
      if (!shuttingDown) console.error(`Local AI server exited (${signal || code})`);
    });
  } else {
    console.warn(`Local AI resources were not found in ${aiDirectory()}`);
  }

  const staticDir = join(app.getAppPath(), 'dist');
  if (!existsSync(join(staticDir, 'index.html'))) {
    throw new Error('Desktop assets are missing. Run npm run build before starting Electron.');
  }
  localServer = await startServer({
    dataDir: join(app.getPath('userData'), 'data'),
    staticDir,
    aiBaseUrl
  });
  console.log(`Local desktop server listening at ${localServer.url}`);

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: '#f8fafc',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: !app.isPackaged
    }
  });

  const appOrigin = new URL(localServer.url).origin;
  mainWindow.webContents.on('will-navigate', (event, target) => {
    if (new URL(target).origin !== appOrigin) event.preventDefault();
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => { mainWindow = undefined; });
  await mainWindow.loadURL(localServer.url);
}

async function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    if (localServer) await localServer.close();
    await stopChild(aiProcess);
  } catch (error) {
    console.error('Desktop shutdown failed:', error);
    exitCode = 1;
  } finally {
    app.exit(exitCode);
  }
}

if (hasLock) {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.on('before-quit', (event) => {
    if (shuttingDown) return;
    event.preventDefault();
    void shutdown();
  });
  app.on('window-all-closed', () => app.quit());
  app.on('certificate-error', (event, _webContents, _url, _error, _certificate, callback) => {
    event.preventDefault();
    callback(false);
  });

  app.whenReady().then(async () => {
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    await createWindow();
  }).catch(async (error) => {
    console.error('Desktop startup failed:', error);
    dialog.showErrorBox('Strategic Data Fusion', `The application could not start.\n\n${error.message}`);
    await shutdown(1);
  });
}

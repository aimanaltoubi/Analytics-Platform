# Strategic Data Fusion

Strategic Data Fusion is a fully local document and entity analysis application. The React interface, Node.js API, SQLite database, uploaded files, authentication, and optional AI model all run on the same computer.

## Requirements

- Node.js 22.13 or newer
- npm
- Windows 10/11 for producing and testing the Windows installer

Install dependencies:

```bash
npm install
```

## Local browser development

Start the local API in one terminal:

```bash
npm start
```

Start Vite in a second terminal:

```bash
npm run dev
```

Open the loopback URL printed by Vite. Vite proxies `/api` and `/files` to the local API at `127.0.0.1:3001`.

The first account registered becomes the local administrator. Save the recovery key displayed during registration; it is required to reset that account's password.

## Desktop development

Build the frontend and launch Electron:

```bash
npm run desktop
```

Electron starts the API on a random loopback port and stores persistent data under the operating system's per-user application-data directory. Browser APIs do not receive Node.js or Electron privileges.

## Optional local AI

Database, authentication, upload, backup, CSV, text, and PDF features work without an AI model. AI extraction and analysis require a local llama.cpp server bundle.

For Windows packaging, extract the complete official llama.cpp CPU x64 release into `resources/ai/`, then add one GGUF instruct model. The directory must include at least:

```text
resources/ai/
├── llama-server.exe
├── llama-server-impl.dll
├── llama-common.dll
├── llama.dll
├── ggml*.dll
├── libomp.dll
└── your-instruct-model.gguf
```

Use a llama.cpp build and a GGUF instruct model whose licenses permit redistribution. Runtime binaries and model files are intentionally not stored in git; their license and attribution files are. At runtime the desktop app launches the bundled server on a random loopback port; it never configures a remote AI endpoint.

For desktop development on Linux or macOS, use a platform-native executable named `llama-server` in the same directory. You can alternatively set `LOCAL_AI_DIR` to an external bundle directory.

## Validation

```bash
npm test
npm run lint
npm run build
npm run check:offline
```

`check:offline` scans the complete repository, including hidden files and path names, for prohibited platform references and known remote asset hosts.

## Build a Windows executable

After adding the local AI resources, run on Windows:

```bash
npm run package:win
```

The NSIS installer and GGUF model sidecar are written to `release/`. Keep both files in the same directory when installing. Because NSIS installers have a 2 GB size limit, the installer copies the model from beside itself into the application rather than embedding the model in the `.exe`. If the sidecar is missing, installation succeeds with a warning and AI analysis remains unavailable.

A portable executable can be built with:

```bash
npm run package:portable
```

Keep the model sidecar beside the portable executable. The desktop runtime discovers it there without copying it. Packaging deliberately stops when the complete llama.cpp runtime, license files, or a real `.gguf` model is missing.

The provided Qwen2.5 14B Q4_K_M model targets computers with at least 32 GB RAM. Lower-memory deployments should substitute a smaller model and update `build/installer.nsh` to use its exact filename.

## Local data and backups

The desktop database and uploads remain in the current user's application-data directory and are not removed during a normal uninstall. Administrators can export and restore backups from **Settings**.

Backups contain local records and uploaded files. They do not contain passwords, sessions, recovery keys, or the AI model. Backup files can still contain sensitive application data and should be protected accordingly.

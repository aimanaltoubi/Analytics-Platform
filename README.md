# Strategic Data Fusion

Strategic Data Fusion is a fully local document and entity analysis application. The React interface, Node.js API, SQLite database, uploaded files, authentication, and optional AI model all run on the same computer.

## Download for an offline Windows PC

Use an internet-connected Windows PC to download the installer and local AI model.
The destination PC needs Windows 10/11 **x64**, at least **32 GB RAM** for the supplied
model, and preferably **30 GB free disk space** during installation. It does not
need Node.js, npm, Git, an AI service account, or internet access.

Open **Command Prompt (CMD)** and run:

```bat
mkdir "%USERPROFILE%\Downloads\StrategicDataFusion-Offline"
cd /d "%USERPROFILE%\Downloads\StrategicDataFusion-Offline"
curl --fail --location --retry 5 --output "Strategic Data Fusion-Setup-1.0.0-x64.exe" "https://github.com/aimanaltoubi/Analytics-Platform/releases/download/v1.0.0/Strategic%20Data%20Fusion-Setup-1.0.0-x64.exe" && curl --fail --location --retry 5 --continue-at - --output "Qwen2.5-14B-Instruct-Q4_K_M.gguf" "https://huggingface.co/bartowski/Qwen2.5-14B-Instruct-GGUF/resolve/05244aa5d871c661c80082a15d3bce44714d068d/Qwen2.5-14B-Instruct-Q4_K_M.gguf" && curl --fail --location --retry 5 --output "SHA256SUMS.txt" "https://github.com/aimanaltoubi/Analytics-Platform/releases/download/v1.0.0/SHA256SUMS.txt"
```

The long third line is **one command**. The installer is approximately 140 MB;
the model is approximately 9 GB. If a download is interrupted, run the third line
again to resume the model download (the smaller installer downloads again).
Do not run the installer until both downloads are complete.

Verify the files before transferring or installing:

```bat
certutil -hashfile "Strategic Data Fusion-Setup-1.0.0-x64.exe" SHA256
certutil -hashfile "Qwen2.5-14B-Instruct-Q4_K_M.gguf" SHA256
type SHA256SUMS.txt
```

Both hashes must match the corresponding entries in `SHA256SUMS.txt`.
If either differs, do not install; obtain a complete, verified download first.

Copy the folder to a USB drive formatted as **exFAT or NTFS**, not FAT32
(the model exceeds FAT32's 4 GB file limit). On the offline PC:

1. Copy the folder onto its local disk.
2. Keep the `.exe` and `.gguf` together with their exact filenames.
3. Run `Strategic Data Fusion-Setup-1.0.0-x64.exe`. The installer copies the
   local AI model into the application; it does not download it.
4. Launch Strategic Data Fusion and register the first local administrator.
   Save the recovery key securely.
5. Test a document upload and AI analysis while the PC remains disconnected.

The installer is not code-signed. Windows may display an unknown-publisher warning;
verify the release source and checksums before deciding whether to run it.
The Windows installer has been cross-built; a native Windows installation and AI
smoke test are still required on the destination hardware.

The installer creates a new local database. To transfer existing records and
uploads too, export a backup from **Settings** on the source installation and
restore it through **Settings** on the destination. Backups do not transfer accounts,
passwords, sessions, or recovery keys.

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

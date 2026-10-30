# Strategic Data Fusion

Strategic Data Fusion is a fully local document and entity analysis application. The React interface, Node.js API, SQLite database, uploaded files, authentication, and optional AI model all run on the same computer.

## Current download for an offline Windows PC

**What is available now:** the published v1.0.7 release is a two-file package.
Download both the installer and the `.gguf` model, keep them in the same folder,
and run the installer from that folder to enable AI offline. The installer alone
does not include the model. The planned single-file installer is not published,
so do not expect the current download link to provide one EXE containing everything.

Use an internet-connected Windows PC to download the installer and local AI model.
The destination PC needs Windows 10/11 **x64**, at least **32 GB RAM** for the supplied
model, and preferably **30 GB free disk space** during installation. It does not
need Node.js, npm, Git, an AI service account, or internet access.

On an internet-connected Windows PC, open **Command Prompt (CMD)**. Run each
step in order. Each step has its own command; do not combine them.

1. Create the download folder:

   ```bat
   mkdir "%USERPROFILE%\Downloads\StrategicDataFusion-Offline"
   ```

2. Move into that folder:

   ```bat
   cd /d "%USERPROFILE%\Downloads\StrategicDataFusion-Offline"
   ```

3. Download the installer:

   ```bat
   curl --fail --location --retry 5 --output "Strategic Data Fusion-Setup-1.0.7-x64.exe" "https://github.com/aimanaltoubi/Analytics-Platform/releases/download/v1.0.7/Strategic.Data.Fusion-Setup-1.0.7-x64.exe"
   ```

4. Download the AI model. This is approximately 9 GB and may take a while:

   ```bat
   curl --fail --location --retry 5 --continue-at - --output "Qwen2.5-14B-Instruct-Q4_K_M.gguf" "https://huggingface.co/bartowski/Qwen2.5-14B-Instruct-GGUF/resolve/05244aa5d871c661c80082a15d3bce44714d068d/Qwen2.5-14B-Instruct-Q4_K_M.gguf"
   ```

   If this download is interrupted, run the same command again to resume it.

5. Download the checksum file:

   ```bat
   curl --fail --location --retry 5 --output "SHA256SUMS.txt" "https://github.com/aimanaltoubi/Analytics-Platform/releases/download/v1.0.7/SHA256SUMS.txt"
   ```

6. Confirm all three files are present and the model download is complete:

   ```bat
   dir "Strategic Data Fusion-Setup-1.0.7-x64.exe"
   dir "Qwen2.5-14B-Instruct-Q4_K_M.gguf"
   dir "SHA256SUMS.txt"
   ```

7. Verify the installer and model checksums:

   ```bat
   certutil -hashfile "Strategic Data Fusion-Setup-1.0.7-x64.exe" SHA256
   certutil -hashfile "Qwen2.5-14B-Instruct-Q4_K_M.gguf" SHA256
   type SHA256SUMS.txt
   ```

   Compare each `certutil` result with its matching entry in `SHA256SUMS.txt`.
   If either hash differs, do not install; download and verify the files again.

8. Copy the entire folder to a USB drive formatted as **exFAT or NTFS**, not
   FAT32 (the model exceeds FAT32's 4 GB file limit). Keep the installer and
   model together, with their exact filenames.

9. On the offline PC, copy the folder onto its local disk. Open that folder and
   double-click `Strategic Data Fusion-Setup-1.0.7-x64.exe`. The installer reads
   the model beside itself and copies it into the application; it does not
   download the model. If setup warns that the model is missing, close setup,
   put the `.gguf` beside the installer, and run the installer again.

10. Launch Strategic Data Fusion, register the first local administrator, and
    save the recovery key securely. Test a document upload and AI analysis while
    the PC remains disconnected.

## Local data tools

- **قاعدة البيانات:** browse, add, and edit people, companies, and organizations. Profiles support passport/identity, date of birth, registration, contact, and custom fields.
- **مراجعة التكرارات:** scan exact normalized names and aliases. Suggestions never merge automatically; confirmed merges can be undone unless related records have changed.
- **مساعد الأدلة:** ask questions about processed documents and entity profiles. Answers show verified quotes and open the cited record or extracted PDF page. If a quote cannot be verified, the assistant abstains. Chat history stays in the current window.
- **Drill-down:** dashboard and yearly-statistics cards, chart slices, and bar rows open the matching entity, document, relationship, or alert list. Entity links include a direct route to edit the local profile.
- **Field provenance:** extracted profile values link to the exact supporting document page and quote; changed or manually entered values are marked as manual. Reprocessing preserves manually edited values.

The installer is not code-signed. Windows may display an unknown-publisher warning;
verify the release source and checksums before deciding whether to run it.
The Windows installer has been cross-built; a native Windows installation and AI
smoke test are still required on the destination hardware.

The installer creates a new local database. To transfer existing records and
uploads too, export a backup from **Settings** on the source installation and
restore it through **Settings** on the destination. Backups do not transfer accounts,
passwords, sessions, or recovery keys.

## Developer requirements (not needed to install the release)

Node.js and npm are only for developers building or running the application from
source. End users do not need to install or download them: the published Windows
installer includes the application runtime, and the offline PC needs no Node.js,
npm, or internet connection. The CMD download steps above only download the
installer, model, and checksums.

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

On the supplied 14B model, local analysis can take several minutes, especially on first use. Keep the application open while it runs. The app waits for the local model server to finish loading, then allows up to 10 minutes for the analysis request.

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

## Evaluation before deployment

Run these commands from a source checkout with dependencies installed:

```bat
npm test
node scripts/evaluate.js --mock --output "%TEMP%\strategic-mock-evaluation.json"
```

The mock runner starts a disposable loopback AI server and the actual local API,
uses isolated temporary SQLite data, and removes that data afterward. Six English,
Arabic, bilingual, contact, negation, and empty-template fixtures are scored against
known entity types and directed relationships. Additional probes cover search,
graph paths, reprocessing, restart, backup, failure handling, hallucinated output,
type collisions, long documents, and a 1000-record bulk operation.

**Mock accuracy is pipeline preservation, not model accuracy.** The JSON report
retains inputs, extracted records, summaries, precision/recall/F1, timings, and
individual failures. A failed probe returns a nonzero exit code; it is not silently
treated as success. Choose a new output filename for each run because the runner
does not overwrite reports.

The initial evaluation identified pipeline issues with invented entities,
reprocessing mention counts, same-name entities of different types, long-document
truncation, and fuzzy-search candidate limits. The current pipeline rejects names
not grounded in document text, does not recount a document's entities on reprocessing,
keeps entity identity type-aware, passes full document text to the model, and searches
beyond the first 1000 entities. The mock checks exercise these regressions, but do
not establish real-model accuracy or production readiness.

For a **real-model** smoke benchmark, use the intended Windows x64 test PC with
at least 32 GB RAM and the supplied runtime/model in `resources/ai/`. In one CMD
window start the model:

```bat
resources\ai\llama-server.exe --model resources\ai\Qwen2.5-14B-Instruct-Q4_K_M.gguf --host 127.0.0.1 --port 8081 --ctx-size 8192 --jinja
```

Wait until the server has loaded the model, then in a second CMD window:

```bat
curl --fail http://127.0.0.1:8081/health
node scripts/evaluate.js --ai-url http://127.0.0.1:8081 --output "%TEMP%\strategic-real-evaluation.json"
```

The real mode does not substitute mock completions. Review all summaries and
unmatched entities/relationships manually: label paraphrases can fail the strict
scorer even when reasonable, and a verbatim evidence snippet is not proof that a
relationship is true. Six short synthetic documents are not a production accuracy
estimate. Use a larger independently annotated, representative corpus and agreed
acceptance thresholds before deployment; measure actual model latency and memory
on the destination hardware.

Also install the released executable on a clean, disconnected Windows PC and
check registration, uploads, AI analysis, search, alerts, backup/restore, restart,
and installation with the sidecar present and missing. Scanned PDFs/images require
OCR, which is not bundled. This source-level evaluation does not certify native
Windows installation, GUI behavior, or real-model performance.

## For maintainers: build the single-file installer

These are build instructions, not download or install instructions for end users.
The command below creates a new installer from a Windows build PC; it does not
download the installer and this build has not been published as a GitHub release.

On a Windows build PC, first add the complete Windows llama.cpp runtime and one
GGUF model to `resources/ai/`. Install Inno Setup 6 and make `ISCC.exe` available
on `PATH`. Then, from the repository folder, run:

```bash
npm run package:win
```

The build creates one self-contained installer in `release/`. It includes the local llama.cpp runtime and GGUF model, and installs both into the application directory. The model is read directly from `resources/ai/` during installer compilation, avoiding an extra staged model copy. The installer is several gigabytes; use exFAT or NTFS when transferring it by USB. The destination PC needs about 30 GB free during installation, and 32 GB RAM is recommended for the bundled model.

The offline installer includes all required AI files, so the destination PC needs no internet access or separate model download. This large single-file installer uses Inno Setup; the regular NSIS installer format remains limited to smaller packages.

A portable executable can be built with:

```bash
npm run package:portable
```

Keep the model sidecar beside the portable executable. The desktop runtime discovers it there without copying it. Packaging deliberately stops when the complete llama.cpp runtime, license files, or a real `.gguf` model is missing.

The provided Qwen2.5 14B Q4_K_M model targets computers with at least 32 GB RAM. Lower-memory deployments should substitute a smaller model and update `build/installer.nsh` to use its exact filename.

## Local data and backups

The desktop database and uploads remain in the current user's application-data directory and are not removed during a normal uninstall. Administrators can export and restore backups from **Settings**.

Backups contain local records and uploaded files. They do not contain passwords, sessions, recovery keys, or the AI model. Backup files can still contain sensitive application data and should be protected accordingly.

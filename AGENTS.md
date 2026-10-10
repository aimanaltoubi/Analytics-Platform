# AGENTS.md

## Project Context

This is a local-first desktop application repository. Treat it as user-owned application code, keep changes focused on the user's request, and preserve existing project conventions.

Start with `README.md` for local setup, environment variables, and publish workflow.

## Key Files

- `src/`: frontend application source.
- `src/api/localClient.js`: frontend local API client.
- `vite.config.js`: Vite development-server configuration.
- `.env.local`: local-only environment values; never commit secrets.

## Working Notes

- Use `npm start` to run the local API and `npm run dev` to run the frontend during browser development.
- Use `npm run desktop` to launch the Electron application with its local API.
- Run the relevant checks from `package.json` before finishing code changes.

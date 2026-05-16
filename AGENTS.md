# AGENTS.md - Clever Demo App Harness

## Purpose

This repo is the Clever-facing demo harness for the Lens feature `bridge-clever-sso`. Keep future agent work legible by putting operational knowledge, validation commands, and integration boundaries in the repo rather than relying on chat history or external notes.

## Golden Rules

- Treat Clever API shapes as external contracts. Do not guess response fields; verify against Clever docs, typed samples, or explicit runtime guards before depending on them.
- Keep the demo app as a harness, not the identity authority. NorthStarET/backend services own durable account linking, production session issuance, migration authority, and audit decisions.
- Do not commit secrets, `.env`, OAuth client credentials, `school.db`, or generated local runtime state.
- Prefer small, mechanical checks that agents can run locally. If a task changes routes, views, schema assumptions, or Clever integration behavior, add or update a validation path in the same change.
- Keep docs close to the files they govern. When behavior changes, update `README.md`, this file, or the relevant Lens story evidence so future agents can discover the rule in-repo.

## Validation

Run this before handing work back:

```bash
npm test
```

The test command is intentionally credential-free. It checks JavaScript syntax and verifies that the repo still exposes the local harness anchors agents rely on.

## Local Runtime Notes

- Install dependencies with `npm install`.
- Create `.env` locally with `CLEVER_CLIENT_ID`, `CLEVER_CLIENT_SECRET`, and `SESSION_SECRET`.
- Start the app with `node server.js` and open `http://localhost:3000`.
- Use Clever Sandbox users for OAuth paths; avoid hard-coding real district data or credentials.

## Lens Notes

- Feature docs live at `docs/bridge/clever/bridge-clever-sso` in the control repo.
- Production behavior changes must respect the feature stories and constitution hard gates: failing tests first, real acceptance coverage, and review before completion.
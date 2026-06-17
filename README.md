# Dovehero CRM

A self-contained, AI-native CRM prototype — the "revenue command deck" — with the **Nova** assistant, deal pipelines, an enterprise data table, a Kanban board, a 360° record view, activity logging, and an insights/forecast view.

The entire app is **one file** (`index.html`) with all HTML, CSS, and JavaScript inline and all data in memory. There is **no backend and no build step**, so it runs anywhere and behaves identically wherever you open it.

---

## 1. Run it

**Option A — just open the file (simplest)**

Double-click `index.html`, or open it in any modern browser. That's it — no install, no server.

**Option B — run a local dev server (nicer for development)**

Requires [Node.js](https://nodejs.org) (any recent version). No `npm install` needed — the server has zero dependencies.

```bash
npm run dev
# or:  node server.js
```

Then open the printed URL (default `http://localhost:5173`).

You can also use any static server you already have, e.g. `python3 -m http.server 5173`.

---

## 2. Open it in Claude Code

[Claude Code](https://docs.claude.com/en/docs/claude-code/overview) is Anthropic's agentic coding tool. To continue building this app there:

**Install Claude Code** (pick one — the native installer needs no Node.js):

```bash
# macOS / Linux / WSL  (recommended)
curl -fsSL https://claude.ai/install.sh | bash

# Windows (PowerShell)
irm https://claude.ai/install.ps1 | iex

# Or via npm (needs Node.js 18+)
npm install -g @anthropic-ai/claude-code
```

Prefer a GUI? The **Claude Code desktop app** (macOS/Windows) lets you use it without the terminal.

**Then point it at this project:**

```bash
cd dovehero-crm-app
claude
```

Claude Code now has the full project in context. Ask it to run, explain, extend, or refactor the app — for example: *"Run this app and walk me through the architecture,"* or *"Add a Contacts page."*

Setup reference: https://docs.claude.com/en/docs/claude-code/overview

---

## 3. Good first tasks to ask Claude Code

The app is intentionally a single file so it always works as-is. Once it's open in Claude Code, these are natural next steps it can do for you (and test locally):

- **Split into modules** — extract the inline `<style>` into `styles.css` and the inline `<script>` into `app.js`, leaving behavior identical. (Good first refactor before bigger changes.)
- **Add persistence** — currently all data lives in memory and resets on reload. Wire it to `localStorage`, or a small backend (Express/SQLite, etc.).
- **Make integrations real** — email/WhatsApp/SMS sending, calendar/meeting scheduling, and sequences are simulated. Connect them to real services.
- **Add a build & deploy setup** — e.g. Vite + a host, if you want a production pipeline.
- **Write tests** — the prototype was developed against a large assertion suite; Claude Code can recreate/extend a test setup for the split-out JS.

---

## 4. What's inside

- `index.html` — the complete app (UI + logic + seed data).
- `server.js` — optional zero-dependency static dev server.
- `package.json` — `dev` / `start` scripts.
- `.gitignore`

**Notes on the prototype**
- Data is seeded in memory; refreshing the page resets it.
- Outbound integrations (email, WhatsApp, SMS, meetings, sequences, document/PDF generation) are **simulated** to demonstrate the workflow, not connected to live services.
- The theme toggle, pipelines, record-layout builder, and Nova assistant are all client-side.

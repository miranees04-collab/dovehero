# Dovehero CRM

An AI-native CRM prototype — the **"revenue command deck"** — built around the
**Nova** assistant, deal pipelines, an enterprise data table, a Kanban board, a
360° record view, activity logging, automations of intent, and an
insights/forecast view.

This is a **Vite + React + TypeScript** single-page app with a clean,
light-first "enterprise" design system (think Linear/Notion), a dark theme, and
all data seeded in memory. There is no backend — outbound integrations (email,
WhatsApp, SMS, documents) are simulated to demonstrate the workflow.

> The original single-file HTML prototype that this was rebuilt from is preserved
> under [`legacy/`](./legacy) for reference.

---

## 1. Run it

Requires [Node.js](https://nodejs.org) 18+.

```bash
npm install
npm run dev
```

Then open the printed URL (default `http://localhost:5173`).

Other scripts:

```bash
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build
npm run typecheck  # tsc --noEmit
```

---

## 1b. Reporting dashboards (prototype)

A second entry point, [`dashboard.html`](./dashboard.html), hosts a HubSpot-style
**CRM reporting dashboard prototype** (`src/dashboard/`): three role-based saved
dashboards (Sales Pipeline · Executive Overview · My Sales Desk) built from a
widget registry, with global date/owner/pipeline filters that recompute every
tile from one seeded in-memory dataset. Widgets can be added, removed,
drag-reordered, freeform corner-resized, and refreshed; thresholds render
green/red (win rate, pipeline coverage, stuck deals). A global top-nav carries
search (`⌘K`), the Nova assistant, refresh, and view controls; the per-page
header keeps the dashboard switcher and filter bar.

```bash
npm run dev                # open http://localhost:5173/dashboard.html
npm run build:dashboard    # bundle it into ONE self-contained HTML file
                           # (dist-dashboard/dashboard.html — shareable anywhere)
```

### Sharing & export

Any dashboard (top-nav **Share**) or individual report (tile ••• → **Share & export**)
opens a share dialog with three tabs:

- **Live link** — a shareable, always-current view link with access scope and
  expiry controls. Links are generated realistically but are mock (no backend).
- **Email** — recipients, subject, message, an **Attach CSV** option, and a
  delivery schedule (once / daily / weekly / monthly) for recurring emailed
  reports. Sending is mocked.
- **Export** — **CSV** and **Excel (.xls)** are real downloads built from the
  report engine's output; **PDF** uses the browser's print dialog against a
  print stylesheet that hides the app chrome and adds a report header. Every
  export reflects the dashboard's current global filters.

### Nova AI — connecting the real Claude API

Nova (`src/dashboard/ai.ts`) answers from a deterministic rules engine over the
in-memory dataset, so the prototype works fully offline with zero setup. To route
answers through a real Claude model instead, open the Nova panel, click the
settings gear, and paste a **proxy endpoint**.

Why a proxy? The dashboard ships as a single self-contained HTML artifact whose
CSP blocks cross-origin requests, and an API key must never live in client code.
So the browser calls a small server *you* host that holds the key and forwards to
Claude (`claude-opus-4-8`). `src/dashboard/novaClient.ts` `POST`s
`{ question, context }` and expects `{ text }` back, falling back to the rules
engine on any error. A reference proxy is ~30 lines:

```ts
// server.ts — run with your ANTHROPIC_API_KEY in the environment
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';

const app = express();
app.use(express.json());
const client = new Anthropic(); // reads ANTHROPIC_API_KEY

app.post('/nova', async (req, res) => {
  const { question, context } = req.body;
  const msg = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    thinking: { type: 'adaptive' },
    system: 'You are Nova, a concise CRM analyst. Answer from the snapshot only.',
    messages: [{ role: 'user', content: `Snapshot:\n${context}\n\nQ: ${question}` }],
  });
  const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  res.json({ text });
});

app.listen(8787, () => console.log('Nova proxy on :8787'));
```

Point the Nova settings field at `http://localhost:8787/nova` (enable CORS for
the artifact's origin) and answers switch to Claude, badged accordingly.

---

## 2. What's inside

```
src/
  main.tsx                # entry; applies persisted theme
  App.tsx                 # shell + routing between views/overlays
  types.ts                # domain types (Deal, Activity, ObjectDef, …)
  data/
    constants.ts          # stages, pipelines, owners, object defs, helpers
    seed.ts               # hero deals + deterministic breadth generator
  lib/
    nova.ts               # next-best-action, risk signals, NL pipeline Q&A
    format.ts             # money / initials / relative-time helpers
  store/
    useStore.ts           # Zustand store + memoized selectors
  styles/
    tokens.css            # design tokens (light + dark)
    global.css            # base + fonts + a11y focus rings
  components/
    layout/               # Sidebar, TopBar (responsive shell)
    deals/                # PipelineBar, Board (DnD), DealCard, DealTable
    record/               # RecordView — the 360° deal view
    insights/             # Insights & forecast analytics
    objects/              # Companies / Contacts / Products / Leads / …
    nova/                 # Nova assistant panel
    composer/             # Email / WhatsApp / SMS composer
    command/              # ⌘K command palette
    panels/               # Notifications
    ui/                   # Button, Badge, Avatar, Ring, Modal, Toasts, Icon
```

### Features

- **Deals** in three views — **Board** (Kanban with drag-and-drop and
  owner swimlanes), **Table** (sortable, filterable, CSV export, a Nova
  "next step" column), and **Insights** (KPIs, stage funnel, weighted
  forecast by month, owner leaderboard, health distribution).
- **360° record view** — stage stepper, a Nova brief with the recommended
  next step and risk signals, buying-group with roles/strength, line items,
  documents, and a live activity timeline with quick logging.
- **Nova AI assistant** — ask natural-language questions about your pipeline
  ("what's at risk?", "forecast", "what should I focus on today?") and get
  computed answers with deep-link action chips.
- **Composer** — draft and "send" Email / WhatsApp / SMS (logged to the
  timeline), with a one-click "Draft with Nova".
- **Command palette** (⌘K), **notifications**, a global **Tasks** panel,
  a **Customize** hub (theme + reset), **undo/redo**, **multi-object
  records** (Companies, Contacts, Products, Leads, Tickets, Invoices),
  **light/dark** theme, and a responsive layout with a mobile nav drawer.
- **Persistence** — your deals, records, and changes are saved to
  `localStorage` and survive reloads; reset anytime from **Customize**.

### Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `⌘K` / `Ctrl+K` | Command palette |
| `⌘J` / `Ctrl+J` | Ask Nova |
| `⌘Z` / `⌘⇧Z` | Undo / redo |
| `Esc` | Close any overlay |

---

## 3. Notes on the prototype

- Deals, records, and edits persist to `localStorage` (keyed `dh-store`);
  the theme preference persists separately. Use **Customize → Reset demo
  data** to restore the seeded pipeline.
- Outbound integrations (email, WhatsApp, SMS, documents) are **simulated**
  to demonstrate the workflow, not connected to live services.
- Good next steps: make integrations real, add saved-view management, a
  small backend for multi-user data, and a test suite.

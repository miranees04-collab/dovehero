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
    import/               # full-screen Import wizard
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
- **Import wizard** — a full-screen, six-step flow (object → source →
  mapping → data → records & settings → report). Import one or more
  objects at once, auto-map file columns to real properties (or create
  new ones inline), clean the data in a live spreadsheet with one-click
  format rules that run on every row at import, preview each record, then
  create the records for real — with undo/redo on the finished import.
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

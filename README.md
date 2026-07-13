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
    products/             # Product Object — catalog, pricing, variants,
                          #   bundles, inventory & deal associations
    objects/              # Companies / Contacts / Leads / Tickets / …
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
- **Product Object** — a first-class product catalog. A KPI header
  (catalog value, average margin, pipeline influenced, stock alerts),
  type tabs (subscription, usage-based, service, physical, digital,
  bundle), search / status / category filters, sortable table, bulk
  actions and CSV export. Each product opens a tabbed side-drawer:
  **Overview** (stats, a Nova insight, inline-editable description &
  tags), **Pricing** (list price, cost, margin bar, multi-currency
  price books, usage volume tiers), **Variants**, **Bundle**
  (component breakdown with bundle savings), **Inventory** (on-hand /
  committed / available with a reorder gauge), **Deals** (the deals
  each product is attached to, computed from line items) and
  **History**. Everything is inline-editable and persists.
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

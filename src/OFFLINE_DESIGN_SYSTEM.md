# Design System — "Strategic Command Center" Aesthetic
*(Companion to OFFLINE_BLUEPRINT.md — the visual specification for the offline port)*

The current app has a deliberate visual identity that must be preserved in the offline port. It is **not** a generic admin panel — it's a light, data-dense, RTL **strategic analytics** surface with a restrained gray base and dark-red accents. The design tokens live in `src/index.css` and `tailwind.config.js`; both port directly.

---

## 1. Design principles (do not deviate)

| Principle | Decision |
|---|---|
| **Mode** | Light only. Dark mode was explicitly rejected. |
| **Base tone** | Light gray (`hsl(220 14% 96%)` background, white cards) — calm, readable, not stark white. |
| **Accent** | **Dark red** (`hsl(0 68% 38%)`) for primary actions, active nav, badges, high-risk framing. |
| **Direction** | **RTL** (`html { direction: rtl }`). All layout, arrows, and reading flow are right-to-left. |
| **Typography** | **Cairo** (Arabic + Latin), single family for heading/body/display. |
| **Density** | High information density — compact spacing, small labels, many data points per screen. |
| **Voice** | "مركز قيادة استراتيجي" (Strategic Command Center) — not a consumer app. No playful colors, no large illustrations. |
| **Terminology** | **Never** use "استخباراتي" (intelligence) — use "تحليلي" / "تحليل روابط" (analytical / link analysis). App name in UI: **"محلّل الكيانات"**. |

---

## 2. Color tokens (port verbatim into `client/src/index.css`)

```css
/* ⚠ Offline: download Cairo .woff2 files and @font-face them locally instead of the Google import. */
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap');

@layer base {
  :root {
    --background: 220 14% 96%;        /* light gray base */
    --foreground: 222 30% 12%;        /* near-black text */
    --card: 0 0% 100%;                /* white cards */
    --card-foreground: 222 30% 12%;
    --popover: 0 0% 100%;
    --popover-foreground: 222 30% 12%;
    --primary: 0 68% 38%;             /* DARK RED — the signature accent */
    --primary-foreground: 0 0% 100%;
    --secondary: 220 12% 93%;
    --secondary-foreground: 222 30% 12%;
    --muted: 220 12% 93%;
    --muted-foreground: 222 12% 42%;
    --accent: 220 12% 92%;
    --accent-foreground: 222 30% 12%;
    --destructive: 0 72% 45%;
    --destructive-foreground: 0 0% 98%;
    --border: 220 10% 88%;
    --input: 220 10% 88%;
    --ring: 0 68% 38%;
    --radius: 0.5rem;
    --font-heading: 'Cairo', ui-sans-serif, system-ui, sans-serif;
    --font-body: 'Cairo', ui-sans-serif, system-ui, sans-serif;
    --font-display: 'Cairo', ui-sans-serif, system-ui, sans-serif;
    /* Sidebar — slightly lighter gray, same red accent */
    --sidebar-background: 220 12% 95%;
    --sidebar-foreground: 222 30% 18%;
    --sidebar-primary: 0 68% 38%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 220 12% 90%;
    --sidebar-accent-foreground: 222 30% 12%;
    --sidebar-border: 220 10% 86%;
    --sidebar-ring: 0 68% 38%;
  }
}

@layer base {
  * { @apply border-border outline-ring/50; }
  body { @apply bg-background text-foreground font-body; }
  html { direction: rtl; }   /* RTL is global */
}
```

### Offline font note
The Google Fonts `@import` won't work air-gapped. Download `Cairo-Regular.woff2`, `Cairo-SemiBold.woff2`, `Cairo-Bold.woff2` while online and serve them locally:

```css
@font-face { font-family: 'Cairo'; src: url('/fonts/Cairo-Regular.woff2') format('woff2'); font-weight: 400; font-display: swap; }
@font-face { font-family: 'Cairo'; src: url('/fonts/Cairo-SemiBold.woff2') format('woff2'); font-weight: 600; font-display: swap; }
@font-face { font-family: 'Cairo'; src: url('/fonts/Cairo-Bold.woff2') format('woff2'); font-weight: 700; font-display: swap; }
```
Place the `.woff2` files in `client/public/fonts/`.

---

## 3. Tailwind config (port verbatim)

The `tailwind.config.js` maps the tokens above to utility classes. Copy it as-is — it defines `background`, `foreground`, `card`, `primary`, `sidebar.*`, `chart.1–5`, and the `font-heading/body/display` families. No changes needed offline.

---

## 4. Layout anatomy (the command center shell)

The app shell is a fixed **right-side sidebar + top command bar + content area** (RTL, so the sidebar is on the right):

```
┌──────────────────────────────────────────────────────┐
│  Top command bar (h-14): search │ notifications │ status │
├──────────────────────────────────────┬───────────────┤
│                                      │  Sidebar      │
│   Content area (scrollable)          │  (w-60, RTL)  │
│   - dashboard cards                  │  • لوحة العمليات│
│   - data tables                       │  • المستندات   │
│   - network graphs                    │  • الكيانات     │
│   - geo-temporal map                  │  • ...         │
│                                      │  user + logout │
└──────────────────────────────────────┴───────────────┘
```

- **Sidebar** (`src/components/Layout.jsx`): grouped nav (الرئيسية / الاستيعاب / التحليل / العمليات / البحث), active item gets a thin red bar on the right edge + muted accent background.
- **Top bar**: full-width search input (links to `/search`), `NotificationsBell`, `SystemStatus` (live counts of pending docs + active alerts).
- **Content**: page-specific, always inside rounded `border border-border bg-card` cards with `p-5`.

---

## 5. High-risk entity framing

A signature visual rule: **high-risk entities get a dark-red frame**, not just a number. In entity cards, tables, and the security watch panel:

```jsx
// risk_score >= 70 → dark red border + red-tinted background
const riskClass = entity.risk_score >= 70
  ? 'border-2 border-red-800 bg-red-50'
  : entity.risk_score >= 40
    ? 'border border-amber-300 bg-amber-50'
    : 'border border-border bg-card';
```

Sort high-risk entities to the top of lists by default.

---

## 6. Dashboard pages — what to preserve

### Operations dashboard (`Home.jsx`)
- KPI cards row (documents, entities, connections, alerts) — compact, icon + number + label.
- Recent documents table (title, type badge, status, entity count, time).
- Top-mentioned entities list (name, type, mention count, risk chip).
- Document uploader inline.

### Analytics dashboard (`Analytics.jsx` — the page you're viewing)
- Summary stat cards.
- Entity distribution by type (BarList — RTL-safe).
- Risk distribution.
- Relationship-type breakdown.
- Top entities by centrality.
- All charts use the `chart.1–5` tokens (red-dominant palette).

### Analytical report (`Report.jsx`)
- Force-directed network visualization (primary + neighbors).
- Summary statistics.
- Distribution charts.
- Ranked entity lists.
- PDF export via html2canvas + jsPDF (both work offline).

### Geo-temporal map (`GeoTemporal.jsx`)
- Leaflet map (retiled to local server).
- Timeline playback controls.
- Entity info-card on tap (photo, type, attributes).
- Color-coded points per entity (not uniform red circles).
- Clear-map + restore controls.

---

## 7. Component inventory to port (visual only — no logic change)

These components carry the aesthetic and must be copied as-is (only swapping `base44` → `api` imports per the blueprint's §12):

| Component | Role in the aesthetic |
|---|---|
| `src/components/Layout.jsx` | The command-center shell (sidebar + top bar). |
| `src/components/SystemStatus.jsx` | Live status chips in the top bar. |
| `src/components/NotificationsBell.jsx` | Bell + dropdown in the top bar. |
| `src/components/SecurityWatchPanel.jsx` | High-risk entity framing. |
| `src/components/BarList.jsx` | RTL-safe horizontal bars for analytics (prevents text overlap). |
| `src/components/NetworkGraph.jsx` / `GraphCanvas.jsx` | Force-directed network visualization. |
| `src/components/GeoTemporalMap.jsx` | Map + timeline (retile to local server). |
| `src/components/InvestigationReport.jsx` | PDF report layout (html2canvas + jsPDF — both work offline). |
| `src/pages/Home.jsx` | The operations dashboard. |
| `src/pages/Analytics.jsx` | The analytics dashboard. |
| `src/pages/Report.jsx` | The analytical report with network viz + PDF export. |

---

## 8. Design anti-patterns (what to avoid)

- ❌ Dark mode / dark themes.
- ❌ Bright/saturated colors (neon, candy) — only the dark-red accent and muted grays.
- ❌ Large hero illustrations or marketing-style sections.
- ❌ The word "استخباراتي" anywhere in the UI.
- ❌ Generous whitespace / low density — this is a data-dense tool.
- ❌ LTR layout or left-pointing arrows in RTL context (arrows follow natural reading direction).
- ❌ Replacing the Cairo font with a non-Arabic-optimized family.

---

## 9. Iconography

Use **lucide-react** (already a dependency, works offline). Icons are 16px in nav, 18–20px in cards, 24px in empty states. Keep stroke weight consistent (default 2). The sidebar logo is a `Network` icon in a red rounded square.

---

*This document is the visual contract for the offline port. Pair it with `OFFLINE_BLUEPRINT.md` (architecture + logic) for the complete specification.*
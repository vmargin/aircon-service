# ARCTIC design specification

Surface mode: Operate. Reference: user-provided ARCTIC montage, 2026-10-03. Build its actual dashboard and workflows rather than a flat montage.

## Tokens

Background #071c25; elevated surface #0d2732; inset #091f2a; edge #254650; text #e8f3f7; muted #9ab7c6; ice blue #a7dbff; cyan #3dbce9; mint #63d9af; amber #e6b179; red #ff8d8d. Subtle radial teal light at the top. Thin panel borders and restrained shadow; 12px panel radii, 8px controls. System sans-serif, compact readable 13–14px data text, 30px page titles. Monospace for job identifiers and figures.

## Layout and flow

Desktop: 228px sidebar, top search and account bar, clear title/action row, four metric cards, today's jobs and service overview, technician dispatch and interactive job board, actionable attention panel. Separate calendar, jobs, clients, units, inventory, billing, reports and settings screens. Selected work order opens in a focus-managed modal with detail/checklist/parts/history tabs. New booking exposes customer, unit, date/time, duration, service, technician and priority.

Mobile: keyboard-accessible navigation drawer, stack cards, scroll only inside wide data tables, full-width dialogs. No viewport overflow at 320px. Use 44px interactive targets, visible focus, linked labels, announced errors, loading/empty/error states, and reduced-motion support. Status is text plus color. Search, tabs, actions, filters and chart controls must work. No fake map, live GPS, customer rating, or invented growth metrics.

## Heuristic corrections

Visibility: show job status and mutation outcomes. Match to domain: Scheduled/On site/Completed with ordered transitions. Error prevention: show only valid transitions and validate dispatch, invoices, payments and stock on server. Recognition: expose unit, technician and customer context. Consistency: shared controls and tokens. Recovery: preserve forms and explain errors, provide retries. Efficiency: global search, dashboard links and contextual new-booking actions.

## Stage 6 visual audit — 2026-10-05

The existing React/Vite shell and deep-teal palette already match the user's ARCTIC reference, so the redesign preserves the app's routes, operational data flow, dark default, compact typography, and 12px card language. The audited frontend uses global CSS plus utility classes; the dashboard chart colors were the main inline styles that prevented a theme switch. A light palette now reuses semantic color tokens across the shell, charts, tables, forms, calendar, dialogs, status badges, reports, and login. The saved preference applies before the authenticated shell renders, and the toggle remains a native keyboard-operable button.

Reports now expose an administrator-only branch selector alongside Manila date filters. The three-filter desktop layout, two-date branch-scoped layout, and stacked mobile layout remain readable without changing report authorization or accounting calculations. This is a client-side narrowing of data already returned by the existing organization/branch-scoped API. Open invoice balances also appear in neutral age bands from the issue date, across all issue dates in the selected branch scope. The report excludes and flags balances with unknown history, and does not assume payment terms or call balances overdue.

The redesign intentionally does not add a public booking portal, map/GPS, customer ratings, automated notifications, service-contract billing, or unconfirmed pricing/technical thresholds. See `research.md` for the sourced requirements and business decisions that must precede those features.

The final 320px Playwright pass found a toolbar overflow caused by the global-search text competing with the mobile menu and account controls. At widths up to 360px, search now becomes a named icon button; the dashboard and every core route fit the viewport without hiding table-level horizontal scrolling.

## Light theme tokens

| Role | Color |
| --- | --- |
| App background | `#f3f7f9` |
| Panel | `#ffffff` |
| Inset surface | `#f5f8fa` |
| Border | `#d7e3e8` |
| Main text | `#19343f` |
| Muted text | `#526b77` |
| Accent blue | `#236f91` |
| Accent cyan | `#147f9e` |
| Success | `#176e50` |
| Warning | `#7d5016` |
| Error | `#963b36` |

The light mode keeps the reference's cool teal identity and uses dark text on pale surfaces. Status badges retain explicit labels as well as color. The theme control is a labeled native button with a visible focus ring and a saved browser preference.

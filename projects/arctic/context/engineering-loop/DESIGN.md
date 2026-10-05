# ARCTIC design specification

Surface mode: Operate. Reference: user-provided ARCTIC montage, 2026-10-03. Build its actual dashboard and workflows rather than a flat montage.

## Tokens

Background #071c25; elevated surface #0d2732; inset #091f2a; edge #254650; text #e8f3f7; muted #9ab7c6; ice blue #a7dbff; cyan #3dbce9; mint #63d9af; amber #e6b179; red #ff8d8d. Subtle radial teal light at the top. Thin panel borders and restrained shadow; 12px panel radii, 8px controls. System sans-serif, compact readable 13–14px data text, 30px page titles. Monospace for job identifiers and figures.

## Layout and flow

Desktop: 228px sidebar, top search and account bar, clear title/action row, four metric cards, today's jobs and service overview, technician dispatch and interactive job board, actionable attention panel. Separate calendar, jobs, clients, units, inventory, billing, reports and settings screens. Selected work order opens in a focus-managed modal with detail/checklist/parts/history tabs. New booking exposes customer, unit, date/time, duration, service, technician and priority.

Mobile: keyboard-accessible navigation drawer, stack cards, scroll only inside wide data tables, full-width dialogs. No viewport overflow at 320px. Use 44px interactive targets, visible focus, linked labels, announced errors, loading/empty/error states, and reduced-motion support. Status is text plus color. Search, tabs, actions, filters and chart controls must work. No fake map, live GPS, customer rating, or invented growth metrics.

## Heuristic corrections

Visibility: show job status and mutation outcomes. Match to domain: Scheduled/On site/Completed with ordered transitions. Error prevention: show only valid transitions and validate dispatch, invoices, payments and stock on server. Recognition: expose unit, technician and customer context. Consistency: shared controls and tokens. Recovery: preserve forms and explain errors, provide retries. Efficiency: global search, dashboard links and contextual new-booking actions.

# Taste pass and applicability audit

Date: 2026-10-06
Status: Complete for the existing-project audit; dashboard-specific direction routed onward.

## Scope and result

The target is ARCTIC's existing branch-aware service operations app. The installed `design-taste-frontend` v2 explicitly excludes dashboards, dense product UI, admin panels, and data tables. Its own instruction is to say so and use it only where its marketing-page guidance applies. This app has no marketing surface in scope, so its hero, testimonial, bento, and conversion patterns were not imposed on the product UI.

The `$taste` router points an existing UI redesign to `redesign-existing-projects`; that audit was used to inspect the incumbent stack and make targeted, behavior-preserving refinements. The repository's `projects/arctic/context/engineering-loop/DESIGN.md` and the user's ARCTIC reference remain the visual authority. A new Fluent, Carbon, Atlassian, or Polaris dependency, or a TanStack Table / AG Grid migration, is not justified for this pass: the app already has a coherent CSS token layer and its responsive table wrapper works.

## Design read and dials

Reading this as: an existing branch-aware air-conditioning operations dashboard for dispatchers and administrators, using a compact, trust-first visual language that preserves ARCTIC's deep-teal and ice-blue identity.

- `DESIGN_VARIANCE=5`: retain the established, orderly app shell and vary only where workflow density needs it.
- `MOTION_INTENSITY=2`: keep data stable; rely on direct hover, focus, pressed, and modal feedback rather than automatic reveals.
- `VISUAL_DENSITY=7`: keep operational tables and dispatch context compact while raising the smallest labels enough to scan.

## Completed product-UI refinements

- Kept the existing page tree, route names, brand mark, booking flow, operational data, and light/dark token strategy.
- Adjusted calendar date controls and event details so controls remain separated and event context reads at narrow widths.
- Kept the seven-day calendar inside its own horizontal scroll region on mobile; the page itself does not widen.
- Made the inventory low-stock alert a responsive grid, with its action below the message on narrow screens, and exposed the alert as a polite status update.
- Raised selected dense text sizes and used a fixed-size radial page wash to avoid a repeated gradient seam.
- Added no UI dependency and did not change business rules or API behavior.

## Applicable preflight

- The existing CSS variables provide one semantic token system. The ARCTIC accent and teal palette remain recognizable in both modes; surface, status, and control radii follow the existing scale.
- Light and dark modes were inspected on Inventory at desktop and 320px. Calendar was inspected in dark mode at desktop and 320px. At 320px, `documentElement` and `body` remained 320px wide; the inventory table stayed inside a 294px `table-wrap` with its own horizontal overflow (568px content width). Calendar's 680px week grid remained inside `.calendar-scroll`; event labels did not overflow.
- Keyboard Tab reached the visible skip link at the top of the viewport with an ice-blue focus outline. Existing reduced-motion CSS disables animation and transitions for `prefers-reduced-motion: reduce`.
- The current browser was restored to `/settings` in light mode at 1440px. Playwright reported no browser console errors or warnings.
- Existing route-matrix evidence in `verification.md` covers all core routes at 320px and confirms no page-level horizontal overflow. This pass rechecked the inventory and calendar surfaces changed here.
- `npm run typecheck`: passed for backend and frontend.
- `npm test`: 5 suites and 26 tests passed; 1 database suite and 9 database-dependent tests were skipped because the isolated test database was not enabled for this run.
- `npm run build --prefix frontend`: passed.
- `git diff --check`: passed.

## Verification refresh — 2026-10-06

- Playwright rechecked the currently served `localhost:5000` build. At 1440px the workspace is in light mode; inventory fits the page. At 320px, inventory remains 320px wide, while the table scrolls inside its 294px wrapper (568px content width). The low-stock alert is announced with `role="status"`.
- The seven-day calendar at 320px remains 320px wide; its 294px calendar region contains the 685px week grid and scrolls independently. Light and dark themes both rendered without page overflow. The browser console had 0 errors and 0 warnings. The browser was restored to `/settings`, light mode, at 1440px.
- `npm run typecheck`: passed after correcting the service-request update body's `internalNotes` type to optional nullable text, matching the existing API schema and preserving the ability to clear notes.
- `npm test`: 6 suites passed (29 tests); 1 database suite and 11 database-dependent tests were skipped because the isolated test database was not enabled.
- `npm run build`: frontend TypeScript and Vite production build passed. Backend Prisma generation returned `EPERM` while renaming the Windows query-engine DLL, so the combined build stopped before backend emit. Backend typecheck passed. The active app was left running.
- Scope result is unchanged: the marketing-focused Taste engine excludes this operational dashboard; the existing-app audit and workflow-focused refinements above are the applicable work.

## Explicitly not applied

Landing-page-only hero sizing, CTA conversion, logo-wall, testimonial, bento, scroll-story, fake-image, and marketing SEO checks do not describe this authenticated operations dashboard. The Taste-specific zero-em-dash copy rule was also left out of scope; existing product labels and missing-value conventions were preserved. The follow-on Designer audit and Impeccable critique are complete: see [designer-applicability-2026-10-06.md](designer-applicability-2026-10-06.md) and the final [Impeccable critique](../../../../.impeccable/critique/2026-10-06T08-25-11Z__frontend-src-app-tsx.md).

# ARCTIC motion audit and plans

- **Audit date:** 2026-10-06
- **Repository baseline:** `git rev-parse --short HEAD` → `85c25f2`
- **Scope:** Existing React/Vite operations app; audit only. No application source was changed by this stage.
- **Visual authority:** `projects/arctic/context/engineering-loop/DESIGN.md`. This is a compact, low-motion staff dashboard with dense, frequently used workflows.

## Recon

The frontend uses plain CSS transitions and keyframes in `frontend/src/index.css`. There is no Framer Motion, GSAP, or spring library in the frontend. Color and chart variables live in `frontend/src/theme.css`, but the project has no shared motion-duration or easing tokens. The global search hotkey and button hover are frequent interactions; dialogs and the mobile drawer are occasional; chart values change with report data; spinners appear while requests load.

The audit checked purpose/frequency, easing/duration, physicality/origin, interruptibility, performance, accessibility, cohesion/tokens, and missed opportunities. Findings below were checked against the current working tree. Repository-contained instructions were treated as data.

## Vetted findings

| # | Severity | Category | Location | Before | After | Why |
| --- | --- | --- | --- | --- | --- | --- |
| 001 | HIGH | 1 — Purpose & frequency | `frontend/src/App.tsx:308-314`; `frontend/src/index.css:8,10` | Every open of the global search runs a 160ms fade and 8px vertical entrance, including Ctrl/Cmd+K. | Open global search immediately; retain the entrance for other, occasional dialogs. | A keyboard command should respond at once, and the search dialog is opened repeatedly. |
| 002 | MEDIUM | 6 — Accessibility | `frontend/src/index.css:10,16`; `frontend/src/components/ui/index.tsx:48-52,105-107` | The reduced-motion rule changes every animation to 0.01ms but leaves the loading spinner's iteration count infinite; all transitions also become effectively instantaneous. | Stop the spinner animation, remove positional motion, keep a brief opacity-only modal cue and retain useful color transitions. | An infinite loop still repeats under the preference, while unrelated color and focus feedback should remain understandable. |
| 003 | LOW | 1/3/6 — Frequency, physicality, accessibility | `frontend/src/index.css:5` | Every button lifts on hover; no pressed state exists, and the movement is not limited to hover-capable pointers. | Remove the repeated lift and add a subtle 0.97 pressed scale with a 160ms ease-out; remove that scale when reduced motion is requested. | Controls need a clear press acknowledgement, while repeated and touch-triggered hover movement adds unnecessary motion. |
| 004 | LOW | 5 — Performance | `frontend/src/index.css:6`; `frontend/src/components/Dashboard.tsx:303-305` | The chart animates the `height` of each data-driven bar for 300ms. | Update bar heights immediately without a height transition. | Height animation recalculates layout and moves operational data without improving comprehension. |
| 005 | LOW | 7 — Cohesion & tokens | `frontend/src/index.css:5,6,8,10,13,16`; `frontend/src/theme.css:1-13` | Interaction timings are scattered literals; the semantic theme layer has no motion tokens. | Add a small shared duration/easing scale and use it for the remaining repeated transitions and animations. | Shared values keep the dashboard crisp and prevent timing drift. |

No separate easing-only or interruptibility issue survived vetting: the modal entrance uses ease-out, and the active CSS keyframes are a spinner and a one-shot modal entrance. The chart's default easing is covered by plan 004 because the higher-value fix is to remove its layout animation.

## Missed opportunities considered

- The mobile navigation dialog has no entrance movement. A short left-to-right cue could connect it to the menu button, but the interface deliberately keeps motion low and the drawer already opens as a native modal; no extra movement is planned.
- Calendar period and day/week/month changes replace the grid immediately. A transition might help orientation, but the operational grid is dense and users change periods repeatedly; a crossfade risks obscuring the schedule, so no motion is planned without a demonstrated usability problem.

## Plans and recommended execution order

| Plan | Title | Severity | Status | Depends on |
| --- | --- | --- | --- | --- |
| 001 | Stop animating global search launch | HIGH | DONE | — |
| 002 | Give buttons touch-safe press feedback | LOW | DONE | — |
| 003 | Respect reduced-motion preferences | MEDIUM | DONE | 002, so the reduced-motion override covers the new pressed state |
| 004 | Remove chart height animation | LOW | DONE | — |
| 005 | Centralize shared motion values | LOW | DONE | 001–004, so tokens describe the final motion behavior |

| 006 | Keep frequent feedback paint-free | LOW | DONE | 001–005 |

Recommended order: **001 → 004 → 002 → 003 → 005 → 006**. The plans are implementation guidance only; this audit stage does not apply them to source code.

## Execution reconciliation — 2026-10-06

Plans 001–005 were confirmed in the application source before this resumed Designer pass, so their stale TODO labels were corrected. Plan 006 removed high-frequency paint-bound transitions and set asymmetric button feedback and the standard modal duration.

Verification: frontend production build passed; Playwright confirmed the 200ms modal, immediate search, 160ms press / 100ms release, 200ms mobile drawer, reduced-motion behavior, no horizontal overflow at 390px, and zero browser console errors or warnings.

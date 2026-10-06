---
target: existing ARCTIC Aircon Service dashboard and authenticated operations UI
total_score: 31
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 1
target_identity: "file:frontend/src/App.tsx"
target_fingerprint: "sha256:6d0d3940438db8246b728311326d15f33f1596e38bf941684fdee1350d7e88e8"
target_path: "frontend/src/App.tsx"
timestamp: 2026-10-06T08-25-11Z
slug: frontend-src-app-tsx
closed: true
---
Method: dual-agent (A: /root/impeccable_a_review · B: /root/impeccable_b_evidence)

# ARCTIC Aircon Service — Impeccable Critique

**Target:** Existing ARCTIC authenticated operations UI, anchored by frontend/src/App.tsx
**Snapshot scope:** Source as reviewed before the follow-up fixes.

## Design health

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of system status | 3/4 | Statuses, counts, and search states are clear. |
| 2 | Match to the real world | 4/4 | Service, equipment, branch, and Manila-time language fits ARCTIC. |
| 3 | User control and freedom | 3/4 | Desktop sidebar actions fall below a 720px viewport. |
| 4 | Consistency and standards | 3/4 | Client-mode buttons lack a programmatic selected state. |
| 5 | Error prevention | 3/4 | Sampled booking fields and actions are clear; submission was not tested. |
| 6 | Recognition rather than recall | 4/4 | Navigation is labeled; search shows useful identifiers. |
| 7 | Flexibility and efficiency | 3/4 | Ctrl/⌘K helps, though common searches can return eight records to scan. |
| 8 | Aesthetic and minimalist design | 3/4 | ARCTIC’s visual language is cohesive; the dashboard middle row has uneven density. |
| 9 | Error recognition and recovery | 3/4 | Search has retry and no-match guidance; form recovery was not exercised. |
| 10 | Help and documentation | 2/4 | Inline guidance exists; no dedicated help entry was visible. |
| **Total** | | **31/40 — Good** | All ten heuristics apply to this Operate surface. |

## Design specificity

Moderately high. Deep teal and ice blue, air-conditioning equipment, branches, Manila scheduling, and service-job language make this feel like ARCTIC’s operations app. Its dashboard structure remains familiar admin UI.

## Overall impression

The interface is calm and task-oriented, and light mode retains the same hierarchy as dark mode. The main usability gap is ensuring navigation and selection remain perceivable at short viewports and to assistive technology.

## What works

- The palette, labels, equipment, and branch details support the product context.
- The “Requires attention” metric links to a useful queue, and today’s jobs connect to the calendar.
- At 320px, the page stays within the viewport; the sampled drawer, search, and booking dialog remain usable.

## Priority issues

1. **P1 — Desktop navigation actions are unreachable without a scroll path.** At 1280×720, the fixed sidebar’s content is 974px tall while the sidebar is 720px high. Settings starts at y=769 and Sign out at y=816. Make the navigation region scrollable while keeping Settings and Sign out reachable. Evidence: frontend/src/index.css:5, frontend/src/App.tsx:364.

2. **P2 — The mobile drawer initially focuses a generic container.** Escape restores focus to the menu trigger, but opening should place focus on the “Close navigation” button. Evidence: frontend/src/App.tsx:344.

3. **P2 — Existing/New client mode is visual-only.** Add pressed-state semantics to the two mode buttons so the current selection is announced. Evidence: frontend/src/components/BookingModal.tsx:281.

4. **P3 — The dashboard’s middle row is sparse beside Technician dispatch.** The Service job board is intentionally collapsed and duplicates information available elsewhere; keep its on-demand behavior instead of adding a filler panel. The remaining whitespace is a low-priority layout tradeoff.

## Personas and cognitive load

Sam may not hear the selected client mode and initially lands on a generic drawer container. Casey must scroll past the mobile metrics and attention card to reach Today’s jobs; on a short desktop viewport, Settings and Sign out sit below view. Alex benefits from Ctrl/⌘K, though “Lee Residence” returned eight results to scan. Booking separates client/site from scheduling, and its Cancel/Save actions were visible in the sampled narrow dialog.

## Emotional journey

The greeting and overview provide a calm entry. The red attention card adds urgency while linking to a clear next step. The booking dialog’s subtitle and visible actions reduce uncertainty. The post-save state was not tested.

## Detector and browser evidence

The detector ran once on frontend/src and returned [] (exit 0, zero findings). Playwright used fresh tabs and synthetic demo records only. Dashboard was inspected at 1440×900 in both themes; service desk, bookings, settings, and reports were inspected at desktop, with bookings and reports also checked at 390px. The document stayed within the viewport on inspected widths. The overlay preflight succeeded, but injection was blocked on /, /bookings, and /settings by the app’s script-src 'self' policy, so no user-visible overlay is available. The temporary server was stopped and port 8400 verified closed.

## Limits

No business mutations were submitted. The review did not cover every route, role, form submission, screen-reader output, 200% zoom, 320px dark mode, or post-save confirmation.

Questions skipped: the user asked me to implement applicable findings during this Impeccable phase.

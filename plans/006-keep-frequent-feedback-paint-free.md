# 006 — Keep frequent feedback paint-free

- **Status**: DONE
- **Commit**: 85c25f2
- **Severity**: LOW
- **Category**: 1/2/5 — Frequency, easing and duration, performance
- **Estimated scope**: 3 frontend files; small

## Problem

The current high-frequency navigation and button rules animate paint-bound color and shadow properties. Fields animate their border color. The default button rule also uses the same duration when pressed and released, and normal dialogs use 160ms even though the motion standard gives dialogs a 200–500ms range.

Current examples:

```css
/* frontend/src/index.css:5 — current */
.nav-item { transition: background var(--motion-hover) ease, color var(--motion-hover) ease; }
.btn { transition: transform var(--motion-short) var(--ease-out), background var(--motion-hover) ease, box-shadow var(--motion-hover) ease; }
.btn:active:not(:disabled) { transform: scale(0.97); }
```

```css
/* frontend/src/index.css:8 — current */
.field-input { transition: border-color var(--motion-standard) ease; }
.arctic-modal[open] { animation: modal-in var(--motion-short) var(--ease-out); }
```

```tsx
/* frontend/src/components/ErrorBoundary.tsx:39 — current */
className="mt-4 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition"
```

The Tailwind `transition` utility adds another paint-bound color transition on the retry button.

## Target

- Keep only composited `transform`/`opacity` motion. Frequent navigation, hover color, button color/shadow, and field-border changes update immediately.
- Keep the 0.97 button press feedback: 160ms on press, then a 100ms ease-out return on release.
- Keep the global-search dialog immediate and the chart bars transition-free.
- Set the normal centered modal entrance to 200ms ease-out. Keep its reduced-motion opacity fade at 160ms.
- Remove the now-unused `--motion-hover` token; retain the short, standard, continuous, and easing tokens that still have consumers.

```css
/* target */
.btn { transition: transform 100ms var(--ease-out); }
.btn:active:not(:disabled) {
  transform: scale(0.97);
  transition-duration: var(--motion-short);
}
.arctic-modal[open] { animation: modal-in var(--motion-standard) var(--ease-out); }
```

## Repo conventions to follow

- Shared durations and curves belong in `frontend/src/theme.css`; use the existing `--motion-short`, `--motion-standard`, and `--ease-out` tokens.
- CSS motion remains in `frontend/src/index.css`; do not add a motion dependency.
- Preserve variant colors, visible focus, 44px target sizes, disabled states, spinner status text, reduced-motion overrides, the native-dialog structure, and the mobile drawer's `--ease-drawer` transition.

## Steps

1. In `frontend/src/index.css`, remove `transition` from `.nav-item` and `.field-input`; keep the existing hover/focus colors.
2. Restrict `.btn` transitions to `transform`. Use 100ms as the base release duration and `--motion-short` for the active 0.97 press.
3. Change the ordinary modal entrance to `--motion-standard`; keep the reduced-motion fade and the search-modal exception intact.
4. Remove `--motion-hover` from `frontend/src/theme.css` and remove Tailwind's generic `transition` utility from the ErrorBoundary retry button.

## Boundaries

- Touch only `frontend/src/index.css`, `frontend/src/theme.css`, and `frontend/src/components/ErrorBoundary.tsx`.
- Do not change copy, colors, focus indicators, click behavior, data transitions, dialog behavior, or the app's reduced-motion preference.
- Do not add dependencies or animate paint/layout properties.
- If a cited rule has drifted since the commit stamp, re-check the live source and update this plan before proceeding.

## Verification

- **Mechanical**: run `npm run typecheck`, `npm test`, and `npm run build`; all available checks should pass. Search frontend source for remaining transitions and confirm each animates only transform/opacity or is an intentional static state change.
- **Feel check**: open global search by keyboard and confirm it appears immediately; press a shared button and confirm scale 0.97 over 160ms and return over 100ms; open a normal dialog and confirm its 200ms centered entrance; verify the chart has no height transition and the drawer retains its short spatial movement.
- Confirm reduced motion removes button scale, spinner rotation, and drawer movement while retaining the modal's brief opacity fade and static focus/color feedback.
- Check light and dark themes at desktop and 320px; page width must not exceed the viewport.
- **Done when**: frequent UI has no paint-bound transitions, press/release timing is asymmetric, the normal modal uses 200ms ease-out, and no search/chart/reduced-motion behavior regresses.

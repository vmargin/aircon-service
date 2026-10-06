# 005 — Centralize shared motion values

- **Status**: DONE
- **Commit**: 85c25f2
- **Severity**: LOW
- **Category**: 7 — Cohesion & tokens
- **Estimated scope**: 2 frontend stylesheets; small

## Problem

Motion declarations in `frontend/src/index.css:5,6,8,10,13,16` use independent literals for navigation, buttons, chart bars, fields, dialogs, the spinner, and the mobile sidebar. `frontend/src/theme.css:1-13` already owns root-level theme variables but defines only color and chart tokens. Plans 001-004 settle which motion should remain before this consolidation is applied.

Current examples:

```css
/* frontend/src/index.css:5-10,13 — current */
.nav-item { transition: background .18s, color .18s; }
.btn { transition: transform .15s, background .15s, box-shadow .15s; }
.field-input { transition: border-color .2s; }
.arctic-modal[open] { animation: modal-in .16s ease-out; }
.spin { animation: spin 1s linear infinite; }
/* At max-width: 1020px */
.sidebar { transition: transform .2s; }
```

## Target

After plans 001-004, add a compact motion scale beside the existing shared root theme tokens in `frontend/src/theme.css` and use it for remaining interactions:

```css
/* frontend/src/theme.css — target tokens */
:root {
  --motion-hover: 180ms;
  --motion-short: 160ms;
  --motion-standard: 200ms;
  --motion-continuous: 1s;
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
}
```

Use `--motion-hover` for navigation and button color/shadow transitions, `--motion-short` for button press and modal entry/fade, `--motion-standard` for field borders and the mobile sidebar, and `--motion-continuous` for the regular spinner. Use `--ease-out` for entering and press feedback and `--ease-drawer` for the mobile sidebar. Preserve `ease` for color changes and `linear` for continuous rotation.

## Repo conventions to follow

- `frontend/src/theme.css` owns shared `:root` theme variables used by both dark and light modes; place tokens there, not in component code.
- Motion remains plain CSS in `frontend/src/index.css`. Do not add a dependency.
- The curve values come directly from the installed motion audit: `cubic-bezier(0.23, 1, 0.32, 1)` for ease-out and `cubic-bezier(0.32, 0.72, 0, 1)` for a drawer.

## Steps

1. Confirm plans 001-004 are complete and inspect the final remaining motion declarations.
2. Add the six tokens in `:root` in `frontend/src/theme.css`.
3. Replace only matching literal durations and easing values in `frontend/src/index.css` with the tokens. Keep `chart-stack` transition-free and the search modal animation-free.
4. Keep the reduced-motion overrides explicit; do not reference motion tokens to re-enable movement under that preference.

## Boundaries

- Touch only `frontend/src/theme.css` and `frontend/src/index.css`.
- Do not add tokens for one-off values, introduce a motion framework, or change business/data behavior.
- Do not restore chart movement or search entrance while replacing declarations.
- If earlier plans are incomplete or the cited rules have drifted since commit `85c25f2`, stop and report the mismatch.

## Verification

- **Mechanical**: run `npm run typecheck`, `npm test`, and `npm run build`; all should pass. Search the frontend styles for remaining literal transition/animation durations and confirm each is intentional (notably the 1s spinner when motion is allowed).
- **Feel check**: in the light and dark themes, verify navigation color, button press, normal modal entry, mobile drawer, and spinner retain the intended timing. Then enable reduced motion and confirm it still removes rotation and positional movement while preserving color feedback and the modal opacity fade.
- Slow playback to 10% in DevTools and confirm the drawer uses the drawer curve and entry/press motion uses the ease-out curve without overshoot.
- **Done when**: repeated CSS timings and curves use the shared tokens, exceptions are documented, both themes render correctly, and all verification passes.

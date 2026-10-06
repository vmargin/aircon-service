# 003 — Respect reduced-motion preferences

- **Status**: DONE
- **Commit**: 85c25f2
- **Severity**: MEDIUM
- **Category**: 6 — Accessibility
- **Estimated scope**: 1 frontend stylesheet; small

## Problem

The rule at `frontend/src/index.css:16` reduces every animation and transition to `.01ms`. It leaves iteration count unchanged, so the spinner at `frontend/src/index.css:10` still has `infinite` iterations; the rule also makes color and focus transitions effectively instantaneous. The spinner markup at `frontend/src/components/ui/index.tsx:48-52,105-107` already exposes loading text or a button label, so a rotating icon is not the only status cue.

Current code:

```css
/* frontend/src/index.css:10,16 — current */
.spin { animation: spin 1s linear infinite; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; scroll-behavior: auto !important; } }
```

## Target

Disable continuous spinner rotation, remove positional motion, and retain a short opacity-only modal cue plus useful color transitions. The active-button override is included after plan 002 adds that state.

```css
/* target */
@keyframes modal-fade { from { opacity: 0; } to { opacity: 1; } }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
  }
  .spin { animation: none !important; }
  .sidebar { transition: none !important; }
  .btn:active:not(:disabled) { transform: none !important; }
  .arctic-modal[open] { animation: modal-fade 160ms ease-out; }
}
```

Do not add `transition-duration: .01ms` globally. The modal fade animates opacity only; the search-specific `animation: none` rule from plan 001 remains more specific. Existing field-border and navigation-color feedback stays intact.

## Repo conventions to follow

- Reduced-motion handling belongs beside the existing global media query in `frontend/src/index.css`.
- Preserve the spinner's `role="status"` and existing loading labels in `frontend/src/components/ui/index.tsx`; make the icon static rather than hiding the status.
- Plan 002 adds the `.btn:active:not(:disabled)` state. Implement plan 002 before this plan so the override is effective.

## Steps

1. Replace the global `animation-duration` and `transition-duration` declarations in the reduced-motion query with only the global `scroll-behavior: auto` declaration.
2. Add a `modal-fade` keyframe that changes opacity from 0 to 1 with no transform.
3. In the preference query, stop `.spin` animation, remove `.sidebar` transitions, override the button active transform from plan 002, and use `modal-fade 160ms ease-out` for open dialogs.
4. Keep other color and border transitions at their normal values.

## Boundaries

- Touch only `frontend/src/index.css`.
- Do not change loading state text, spinner markup, network behavior, focus indicators, or modal behavior outside motion.
- Do not introduce JavaScript preference detection or dependencies.
- If the reduced-motion query or cited selectors have drifted since commit `85c25f2`, stop and report the drift.

## Verification

- **Mechanical**: run `npm run typecheck`, `npm test`, and `npm run build`; all should pass.
- **Feel check**: enable `prefers-reduced-motion: reduce` in DevTools. Confirm loading icons are static while loading text remains, a normal dialog fades without translating, the mobile sidebar appears without sliding, and a pressed button does not scale. Confirm border/color feedback remains perceptible.
- Disable the preference and confirm the normal spinner and modal entrance still work.
- **Done when**: no infinite decorative rotation or positional motion remains under reduced motion, while state text and non-motion feedback remain available.

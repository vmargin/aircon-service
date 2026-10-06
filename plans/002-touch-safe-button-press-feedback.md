# 002 — Give buttons touch-safe press feedback

- **Status**: DONE
- **Commit**: 85c25f2
- **Severity**: LOW
- **Category**: 1/3/6 — Frequency, physicality, accessibility
- **Estimated scope**: 1 frontend stylesheet; small

## Problem

The shared button in `frontend/src/index.css:5` lifts every time it is hovered, including on touch browsers that synthesize hover. It has no `:active` state, so it gives no direct confirmation while pressed.

Current code:

```css
/* frontend/src/index.css:5 — current */
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 9px 15px; font-size: 11px; font-weight: 600; border-radius: 7px; border: 1px solid transparent; transition: transform .15s, background .15s, box-shadow .15s; white-space: nowrap; }
.btn:hover { transform: translateY(-1px); }
```

## Target

Remove the repeated hover lift. Add a subtle scale on active press using the audit's `0.97` target and `160ms ease-out`. Keep the existing background and shadow hover feedback.

```css
/* target */
.btn {
  /* retain the existing layout and visual declarations */
  transition: transform 160ms cubic-bezier(0.23, 1, 0.32, 1),
    background 150ms ease,
    box-shadow 150ms ease;
}
.btn:active:not(:disabled) { transform: scale(0.97); }

@media (prefers-reduced-motion: reduce) {
  .btn:active:not(:disabled) { transform: none; }
}
```

## Repo conventions to follow

- Button variants share the `.btn` base class in `frontend/src/index.css`; keep the feedback in that shared CSS owner.
- Preserve the existing 44px minimum control target, focus ring, variant colors, and disabled state.
- The dashboard uses low motion; do not add hover lift, bounce, or decorative effects.

## Steps

1. In `frontend/src/index.css`, remove the repeated `.btn:hover` transform rule.
2. Keep explicit base transitions for background and box-shadow; set the transform transition to `160ms cubic-bezier(0.23, 1, 0.32, 1)`.
3. Add `.btn:active:not(:disabled) { transform: scale(0.97); }`.
4. Add a reduced-motion override that sets this active transform to `none`. Keep hover color feedback unchanged.

## Boundaries

- Touch only `frontend/src/index.css`.
- Do not change button markup, click behavior, focus styles, colors, disabled behavior, or control dimensions.
- Do not gate color-only hover styles or add a motion library.
- If the cited rule has drifted since commit `85c25f2`, stop and report the drift.

## Verification

- **Mechanical**: run `npm run typecheck`, `npm test`, and `npm run build`; all should pass.
- **Feel check**: on a mouse, hover a primary and secondary button; neither should lift. Press each and confirm a brief 0.97 scale, then release and confirm it returns immediately. Tap on a touch-sized viewport and confirm there is no sticky lifted position. Enable reduced motion and confirm the button does not scale while pressed.
- Keep keyboard focus visible and confirm disabled buttons remain visually and behaviorally unchanged.
- **Done when**: only a direct, subtle press has transform motion, reduced motion removes that movement, and existing variant hover colors still work.

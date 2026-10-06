# 004 — Remove chart height animation

- **Status**: DONE
- **Commit**: 85c25f2
- **Severity**: LOW
- **Category**: 5 — Performance
- **Estimated scope**: 1 frontend stylesheet; tiny

## Problem

The dashboard renders each monthly total as a data-driven inline bar height in `frontend/src/components/Dashboard.tsx:297-305`. `frontend/src/index.css:6` transitions that layout property for 300ms:

```css
/* frontend/src/index.css:6 — current */
.chart-stack { display: flex; flex-direction: column-reverse; width: 100%; min-height: 2px; border: 1px solid #689ab84f; border-radius: 4px 4px 0 0; overflow: hidden; position: relative; transition: height .3s; }
```

Animating height triggers layout work and makes operational totals move when the underlying data changes.

## Target

Remove only the `height` transition. Let the existing percentage height update immediately; do not replace it with a transform animation.

```css
/* target */
.chart-stack {
  /* keep existing layout and visual declarations */
  transition: none;
}
```

## Repo conventions to follow

- The chart is built from semantic CSS classes in `frontend/src/index.css` and inline data values in `frontend/src/components/Dashboard.tsx`.
- Keep the chart's accessible `role="img"` and generated `aria-label` unchanged.
- `projects/arctic/context/engineering-loop/DESIGN.md` calls for stable operational data and restrained motion.

## Steps

1. In `frontend/src/index.css`, remove `transition: height .3s` from `.chart-stack`.
2. Do not alter Dashboard calculations, heights, colors, axes, or chart labels.

## Boundaries

- Touch only `frontend/src/index.css`.
- Do not animate another layout property or add a chart library.
- If the cited rule has drifted since commit `85c25f2`, stop and report the drift.

## Verification

- **Mechanical**: run `npm run typecheck`, `npm test`, and `npm run build`; all should pass.
- **Feel check**: change the dashboard chart period/filter so data changes. Confirm bars update immediately, remain aligned to their grid columns, and still represent the same totals. Check at desktop and narrow mobile width.
- **Done when**: computed styles show no transition on `height` and the chart updates correctly with no layout animation.

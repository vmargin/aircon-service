# 001 — Stop animating global search launch

- **Status**: DONE
- **Commit**: 85c25f2
- **Severity**: HIGH
- **Category**: 1 — Purpose & frequency
- **Estimated scope**: 3 frontend files; small

## Problem

Ctrl/Cmd+K toggles the global search state at `frontend/src/App.tsx:308-314`. The search component renders the shared `Modal` at `frontend/src/App.tsx:142-149`. The shared CSS entrance therefore runs every time this frequent search dialog opens, even though this is a keyboard-initiated action.

Current code:

```tsx
// frontend/src/App.tsx:142-149 — current
<Modal
  isOpen={open}
  onClose={onClose}
  title="Find your next action"
  subtitle="Search service jobs and clients"
>
  <div className="search-modal-content">
```

```tsx
// frontend/src/components/Modal.tsx:36-39 — current
<dialog
  ref={ref}
  className={`arctic-modal modal-${maxWidth} ${className}`}
```

```css
/* frontend/src/index.css:8,10 — current */
.arctic-modal[open] { animation: modal-in .16s ease-out; }
@keyframes modal-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
```

## Target

Global search opens without an entrance animation. Other occasional dialogs keep their existing centered modal entrance.

```tsx
// Modal.tsx: add a general optional className prop; append it to the existing dialog class list
className = "",
// in the prop type:
className?: string;

// App.tsx: SearchDialog only
<Modal
  isOpen={open}
  onClose={onClose}
  title="Find your next action"
  subtitle="Search service jobs and clients"
  className="search-dialog"
>
```

```css
/* frontend/src/index.css — place after the shared modal-open rule */
.arctic-modal.search-dialog[open] { animation: none; }
```

## Repo conventions to follow

- The app uses a shared native-dialog component in `frontend/src/components/Modal.tsx` and global modal styling in `frontend/src/index.css`; extend those owners.
- The general class name prop is optional and must not alter existing modal consumers.
- Keep the global search markup, autofocus, Escape behavior, focus restoration, and query behavior unchanged.

## Steps

1. In `frontend/src/components/Modal.tsx`, add an optional `className` prop defaulting to an empty string, then append it to the existing modal class string.
2. In `frontend/src/App.tsx`, pass `className="search-dialog"` only from `SearchDialog`.
3. In `frontend/src/index.css`, add `.arctic-modal.search-dialog[open] { animation: none; }` after the shared open-dialog animation rule. Do not remove the shared keyframes.

## Boundaries

- Touch only `frontend/src/App.tsx`, `frontend/src/components/Modal.tsx`, and `frontend/src/index.css`.
- Do not change dialog structure, query behavior, keyboard bindings, focus handling, or other dialog timing.
- Do not add dependencies.
- If the cited selectors or component props have drifted since commit `85c25f2`, stop and report the drift.

## Verification

- **Mechanical**: run `npm run typecheck`, `npm test`, and `npm run build` from the repository root; all should pass under the repository's isolated local test configuration.
- **Feel check**: open global search with Ctrl/Cmd+K repeatedly and by clicking its button. Confirm it appears immediately and that the input still receives focus. Open a booking or work-order dialog and confirm its existing 160ms modal entrance remains. Press Escape and confirm focus returns to the prior control.
- In DevTools' Animations panel, slow playback to 10%; the search dialog must have no entrance animation while ordinary dialogs still show the centered fade-and-translate entrance.
- **Done when**: global search has no entrance animation, other dialogs keep theirs, and typecheck/tests/build pass.

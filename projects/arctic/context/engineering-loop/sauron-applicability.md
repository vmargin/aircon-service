# Sauron applicability review

Checked 2026-10-05 for the existing `aircon-service` repository at `056f824`. Scope is the existing React/Vite + Express/Prisma/PostgreSQL application and the requested research, four-branch demo, and light theme. This is not a framework rewrite or a deployment task.

## Harness evidence

- `sauron` CLI 1.3.0 is installed. The repo already has `sauron.config.yaml`, project metadata, and Codex instructions.
- `sauron status` reports registered runtime adapters and a 165-skill catalog. This verifies local registration, not live model runtimes or agent execution.
- `sauron list-skills` was used to select the task-matched capabilities below.
- `sauron init --dry-run` preserved the existing config and reported existing generated adapters unchanged; it simulated a missing VS Code settings file and wrote nothing. The generated adapter files in this checkout are untracked, so no bulk runtime sync was run.
- `sauron add ... --dry-run` checked seven relevant catalog skills and confirmed their destinations without copying files. Global copies already exist in the current user's `.agents/skills` directory.
- `sauron diff` cannot compare skill pins because this repo has no `sauron-skills.lock.json`.
- `sauron trace-report` reports no `.sauron/traces.json`. No Sauron Fellowship execution is claimed. Jarvis separately routed the web research to a bounded Luna worker; that worker did not edit the repository.

## Applicability, one capability at a time

| Sauron capability | Decision | Application to this repo |
| --- | --- | --- |
| `research-and-productivity` → research router | Apply | Gather multiple HVAC workflow and manufacturer sources; separate vendor capability claims from equipment-specific technical guidance; record direct links in `research.md`. |
| `engineering-loop` | Apply | Preserve the existing architecture blueprint, record the research and applicability decisions in the project's engineering-loop folder, inspect before edits, and verify the same build/test/browser baseline afterward. |
| `multi-tenancy-architecture` | Apply | Keep every branch under its organization, reuse the existing branch-scoped endpoint and row filters, and add only the two user-named branch rows to the isolated local demo. No tenant or branch authorization behavior is weakened. |
| `prisma-drizzle-orm` | Apply narrowly | Use the existing Prisma `Branch` model and local-demo seed conventions. Do not add a schema change just to create two more branch records. |
| `database-migration` | Apply narrowly to R6 retry safety | The theme and branches need no schema change. Stock operations use an additive migration with a nullable unique movement key and payload hash, preserving old rows; the API now requires a UUID key for every stock mutation. Verify only against the isolated local databases. |
| `design-engineering` → Stage 6 `visual-redesign-diagnostic-auditor` | Apply | Audit and extend the existing ARCTIC shell and tokens in place. Preserve routes, props, data flow, and the dark reference while adding the light palette and toggle. |
| `accessibility-auditor` | Apply to theme control and palette | Use a named native button, keyboard interaction, focus visibility, adequate text contrast, and runtime checks against the rendered light and dark screens. |
| `frontend-testing` | Apply to critical journeys | Retain the existing API/integration suite; verify login, theme persistence/toggle, operational routes, mobile layout, and visible modal behavior with the configured Playwright browser. |
| `test-data-management` | Apply to local demo update | Keep branch fixtures synthetic and deterministic. Make branch insertion additive and idempotent under the existing localhost `arctic_dev` seed guard; never reset or seed production. |
| `project-onboarding-audit` | Not needed for this request | The user asked for product improvement, not a new onboarding guide; current architecture, design, research, and verification records already document the relevant facts. |
| `api-design` | Apply narrowly to R6 inventory actions | Keep resource-noun routes, validate signed adjustment deltas and reason, preserve existing stock endpoints, require a UUID idempotency key, and define same-key replay/conflict behavior. The existing `/branches` contract already scopes to authenticated organization/branch access. |
| `java-spring-principles` | Not applicable | The user explicitly clarified that the existing repository is the deliverable. Do not switch to the separate remake workspace or change stacks. |
| `cicd-deployment` / platform deployment skills | Not applicable | Push the reviewed feature branch to the existing GitHub repository, but do not deploy, change `master`, or apply production migrations. |

## Product requirements disposition

The research requirements R1–R10 in `research.md` map to existing customer/unit history, booking and dispatch rules, work orders, branch-scoped inventory, receipt ledger, saved maintenance dates, reports, tenancy checks, and responsive UI. This slice adds explicit checklist outcomes, retry-safe stock changes and audited adjustments, the requested Cavite and Bulacan demo branches, branch-filtered reports/CSV, open-balance age bands measured from invoice issue date, and light/dark preference. Unknown historical balances are excluded and flagged; the age bands do not assume due dates, payment terms, or overdue status. Formal estimate/approval workflows, customer communications, service contracts, supplier procurement, and externally integrated payments stay unimplemented until their pricing, legal, provider, and consent policies are chosen. Manufacturer-specific checklist intervals and thresholds remain technician-configured rather than universal defaults.

## Completion gate

- [x] Four local demo branches: Makati, Quezon City, Cavite, and Bulacan (verified in isolated `arctic_dev`).
- [x] Light and dark palettes switch consistently and survive reload; representative text, navigation, and status combinations passed the WCAG 4.5:1 contrast check.
- [x] Branch authorization and existing service/payment invariants remain unchanged; checklist and inventory mutations retain server-side validation and audit records.
- [x] Typecheck, unit/integration suites, production build, and Playwright smoke checks pass after the final inventory and responsive-toolbar changes.
- [x] Only the requested feature branch is pushed; production and `master` remain untouched.

## Verification refresh — 2026-10-06

- Sauron CLI v1.3.0 `fitness --dry-run` reports `fitness=pass findings=0`. `status` verifies the local adapter/catalog registration only; `trace-report` finds no `.sauron/traces.json`. This is not evidence of a live Fellowship run.
- The existing app's service lifecycle now permits an on-site job to be completed before the office issues the one invoice. This follows the researched request-to-work-history-to-invoice flow; `architecture-blueprint.md`, the API regression suite, and README now agree. No payment or historical partial-invoice behavior changed.
- Final branch-scope and service-site ownership checks are covered by the isolated PostgreSQL API tests. See `verification.md` for the exact current commands and the Prisma DLL build limitation.

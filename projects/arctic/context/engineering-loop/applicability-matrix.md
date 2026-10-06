# Research applicability and implementation matrix

Reviewed 2026-10-06 against `research.md`, the current repository, and read-only feature coverage findings. Target remains the existing `aircon-service` app.

## Existing coverage

| Area | Current evidence | State |
| --- | --- | --- |
| Organization and branch authorization | Auth revalidation, `lib/tenancy.ts`, branch-scoped controllers, API coverage | Implemented; preserve. |
| Customer and equipment history | `Customer`, `Unit`, bookings and unit history | Partial: one customer address, no first-class service sites. |
| Intake | Booking form records existing customer, optional unit, service, priority, notes and exact schedule | Partial: no unscheduled inquiry/assessment queue or preferred arrival window. |
| Estimate and approved scope | No estimate model/route | Missing. |
| Calendar and dispatch | Calendar views, branch-bound technicians, active/overlap checks and concurrency protection | Implemented for one scheduled visit per booking; no shift/travel model. |
| Work order | Ordered status lifecycle, findings, notes, parts, saved outcomes and audit log | Implemented with a fixed default checklist and limited field-only ergonomics. |
| Branch inventory | Stock, usage, movement history, adjustment and idempotency | Implemented; job use stores cost but does not imply customer selling price. |
| Invoice and payment | Unique invoice per booking, Decimal, payment ledger, derived balance, legacy partial review | Partial: invoice total is manually entered, no approved estimate-line snapshot. |
| Follow-up | Explicit unit maintenance date, dashboard due view | Partial: no agreements, recurring visits, or notification automation. |
| Reports | Date/branch filters, jobs, technician and receipt views, issue-date balance age bands | Partial: no dedicated maintenance-due/parts-usage report. |
| Theme and product UI | Existing dark theme plus saved light preference, responsive route work | Implemented; Taste → Designer → Impeccable sequence is complete and recorded in the design artifacts. |
| Demo branches | Four synthetic branch rows exist: Makati, Quezon City, Cavite, Bulacan | Implemented as branch master data. Fresh demo user/job/inventory fixtures intentionally remain Makati/QC only; no unsupplied branch staff, customers, addresses, or activity will be invented. |

## Applicable decisions

| Research item | Decision | Work or boundary |
| --- | --- | --- |
| Unscheduled phone/web inquiry | Apply | Add an internal request inbox that can exist before an appointment; keep public intake/portal out until a privacy/contact design is approved. |
| Multi-site customers and unit location | Apply | Add explicit customer service sites; keep legacy customer address and booking/unit records readable. No invented address backfill. |
| Estimate and customer scope approval | Apply | Add manually priced estimate revisions with an explicit approval record; no preset price catalog, tax calculation, external messaging, or signature claim. |
| Estimate-to-booking-to-invoice | Apply | Convert an approved/direct request into the existing booking/work-order flow and snapshot accepted item lines into the existing one-invoice-per-booking model. Keep exact Decimal calculations; do not add tax assumptions or silently bill inventory cost. |
| Configurable inspection forms | Apply | Keep legacy checklist JSON readable; let authorized staff configure future-service templates and record neutral findings/measurements. No universal technical thresholds, intervals, or automatic regulatory pass claim. |
| Parts and purchasing | Existing use applies | Preserve movement ledger, idempotency, branch boundary and stock guards. Supplier purchase orders, transfers and vehicle stock are optional, so defer. |
| Maintenance and follow-up | Existing dates apply | Add source-derived due/parts visibility where supported. Defer service contracts, recurring billing and reminders until terms/frequency/provider/consent are chosen. |
| Work exceptions and completion | Apply within current model | Preserve reasoned status/audit history; expose incomplete checks and billable work to attention views. Photos/signature collection defer pending privacy/retention design. |
| Invoice and collections | Existing ledger applies | Preserve unknown historical partials; add itemized estimates/invoice snapshots only. No payment gateway or BIR-compliance claim. |
| Philippine BIR electronic invoicing | Conditional, do not activate | Confirm taxpayer class, transaction channel, registered branches, CAS/invoicing setup, BIR PTI and EIS certification with accountant/BIR. RMC 98-2026 makes the stated deadline Dec 31, 2026 for covered taxpayers; the app must not issue purported compliant e-invoices without approval. |
| DENR/EMB technician eligibility | Conditional, do not gate dispatch yet | Confirm actual ODS/HFC use, regional registration and required technician/business evidence with EMB. Add credential gates only after real credential and renewal policies are supplied. |
| Safety forms | Apply as configurable records | User-authored job/site checks support SOPs; no generic checklist is claimed to satisfy RA 11058. |
| Privacy and authorization | Apply to every addition | Keep tenant/branch scopes, least privilege, purpose limits, audit events and no extra photo/location data without a concrete policy. |
| Multi-visit work orders | Defer one billing decision | Current model and repository instruction preserve one invoice per booking. A parent job with multiple visits changes when a job may be billed; choose whether one invoice belongs to the root job or each visit before modeling it. |
| Communications, public portal, GPS, external accounting, gateway, payroll | Defer | Require providers, consent, operational policies, or paid integration choices absent from the brief. |
| Java/Spring replacement, marketing site, enterprise route optimizer | Not applicable | User explicitly selected the existing app and repository; no stack rewrite or separate public website. |

## Ordered implementation and acceptance

1. Research and applicability list are written before product edits. **Done** when sources distinguish vendor patterns from legal duties and each requirement has an existing/apply/defer/not-applicable disposition.
2. Implement service sites and unscheduled internal request intake in the existing Express/Prisma/React app. **Done** when requests are branch-scoped and auditable; site/unit/customer consistency is server-validated; legacy bookings remain readable; no public data is fabricated.
3. Implement estimate revisions and approved-scope conversion to the existing booking and invoice path. **Done** when line totals are computed as Decimal server-side, sent quotes cannot be silently rewritten, approval/revision is audited, accepted lines are snapshotted, and duplicate/retry paths preserve one invoice per booking.
4. Implement authorized checklist templates for future work and due/parts reporting using existing source records. **Done** when new bookings receive a safe snapshot, old JSON remains compatible, outcomes and notes are visible, reports respect branch/tenant filters, and no technical limit is assumed.
5. Run repository typecheck, unit tests, isolated integration tests, builds, and Playwright checks. Inspect staged diff and push only the user's existing feature branch to `origin` after all checks pass.

## Final verification refresh — 2026-10-06

- Research, requirements disposition, the existing-app Taste audit, the Designer motion pass, and the post-Designer Impeccable critique are complete. The full evidence is in the linked engineering-loop records and `.impeccable/critique/2026-10-06T08-25-11Z__frontend-src-app-tsx.md`.
- Branch-master data contains Makati, Quezon City, Cavite, and Bulacan. Only supplied branch names/locations were added; no new branch employees, customer addresses, or service activity were fabricated.
- Integration coverage now proves branch-leader access for site-linked, same-branch-history, foreign-history, and ambiguous-history units; maintenance-report scoping; unit/site branch-transfer guards; same-branch booking and intake writes; and completing field work before issuing its invoice.
- `npm.cmd run typecheck`, `npm.cmd test`, and the isolated `npm.cmd run test:integration` passed (41/41 integration-enabled tests). Frontend production build and backend TypeScript emit passed. The full backend build's Prisma generation step hit Windows `EPERM` while replacing the query-engine DLL; the active local app was left running.
- Playwright confirmed the service desk shows all four branches; its request form has no page overflow at 320px; the light/dark toggle switches and restores the saved light mode; and an on-site unbilled work order offers both completion and later invoice creation. No demo record was submitted or changed.
- Sauron CLI `fitness` passed with zero findings. `trace-report` reports no trace file, so no traced Fellowship execution is claimed. Production data and deployment remain untouched.

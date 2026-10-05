# Aircon service workflow research

Public sources retrieved directly over HTTP on 2026-10-03. These are product and maintenance references, not evidence of local market adoption or this project's business results.

| Source | Verified requirements | Applied behavior |
| --- | --- | --- |
| [ServiceTitan HVAC software](https://www.servicetitan.com/industries/hvac-software), HTTP 200 | Scheduling, dispatch, work orders, billing, customer histories/forms, inventory, service reminders | Calendar and dispatch conflict protection, work orders/checklists, stock consumption, follow-up dates |
| [Housecall Pro HVAC software](https://www.housecallpro.com/industries/hvac-software/), HTTP 200 | Calendar dispatch, property equipment and maintenance history, reminders, invoices and payments | Customer-owned unit registry, service history, saved receipts and balances |
| [Carrier AC maintenance](https://www.carrier.com/us/en/residential/hvac-resources/air-conditioners/ac-maintenance/), HTTP 200 after redirect | Filters, coils, refrigerant/leak observations, airflow, electrical, condensate drainage, safety controls | Editable technician inspection checklist and diagnosis |

## Decisions

Use explicitly saved next-maintenance dates. Carrier's US annual guidance does not establish one universal interval for Philippine homes, commercial premises or every unit type. Unchecked inspection entries remain unchecked; the app does not claim an inspection passed automatically.

Retain the existing operational app and PostgreSQL. Extend its responsible controllers and domain helpers rather than add a second system. Preserve existing tenants/branches, booking lifecycle, invoice uniqueness and exact Decimal money. Close the audited gaps: inactive technicians, overlapping appointments, terminal-booking edits, missing stock ledger, missing equipment history, incomplete partial-payment accounting and truncated report reads.

Historical PARTIAL records have no known payment amount. Show review required and exclude unknown amounts from financial totals. Historical PAID records retain their known settled invoice total. New payments receive append-only receipts and idempotency protection; status derives from exact paid totals.

No live GPS integration, automated customer messages, payment gateway, measured customer satisfaction, or invented growth percentages are presented. Reminders and notifications derive from saved work/stock/maintenance state. Supplier procurement, public booking, formal quotation approval and technician self-service are future product choices rather than half-built flows.

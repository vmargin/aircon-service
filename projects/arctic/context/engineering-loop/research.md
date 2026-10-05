# Air-conditioning service-management requirements

Research checked 2026-10-05 against public field-service product documentation and manufacturer / U.S. Department of Energy maintenance references. Vendor pages document common product workflows, not independent proof that every feature is necessary for every contractor. Technical maintenance advice is equipment- and jurisdiction-specific.

## Core operating requirements

| ID | Requirement | Why it matters |
| --- | --- | --- |
| R1 | Keep each customer, service site, contact, and one-or-more installed units linked to that site's service history. Record the unit identity and model/serial details when known, then retain prior jobs, findings, parts, quotes, invoices, and next-service dates. | Commercial sites may have multiple assets, and the arriving technician needs the right equipment and prior work context. |
| R2 | Capture the service request, symptoms, service type, urgency, preferred time, access notes, and relevant unit before dispatch. Support assessment or quote steps when the job needs them; carry approved scope and amounts forward into the job. | Office and field staff need a traceable request-to-work record without repeatedly retyping details. |
| R3 | Schedule and dispatch by branch, technician, date/time or arrival window, duration, priority, site, and work scope. Show assignment and status changes; prevent double-booking and disallow inactive or out-of-branch technicians. | Dispatch must reflect real technician capacity and keep each branch's operations in its own scope. |
| R4 | Give the technician a field-readable work order with customer/site/unit context, diagnosis, notes, inspection checklist, readings where relevant, parts/materials, and job status. Preserve incomplete, failed, and not-applicable checklist outcomes instead of silently treating them as passed. | The office needs a reliable record of what was inspected, found, and performed. Photos and customer sign-off are useful where the business chooses to collect them. |
| R5 | Use configurable, unit-appropriate aircon checklists. Common inspection topics include filters, coils, airflow, condensate drainage, outdoor-unit condition, thermostat/performance, electrical connections, and refrigerant/leak observations where the technician and equipment require them. | Manufacturer/DOE references describe overlapping checks, while also tying exact work to equipment type, model, and manufacturer instructions. |
| R6 | Track parts by branch, with item identity, unit, cost, on-hand/reorder levels, and append-only receiving/use/adjustment history. Attach consumed parts to the work order; guard stock updates against negative balances, retries, and concurrent use. | Stock needs to reconcile to jobs and costs; old movements should remain auditable. Purchase orders, suppliers, truck stock, barcode scanning, and transfers are larger extensions. |
| R7 | Carry approved service/material line items into an invoice. Record each payment as a separate dated event with method/reference and receipt; derive paid/partial/unpaid state and remaining balance from exact amounts. Keep invoice sending distinct from payment collection. | This preserves a correct money trail and makes partial balances and collection reports meaningful. Tax, discount, warranty, deposit, and credit policy must be configured by the business. |
| R8 | Retain completed-service history and explicitly saved next-maintenance dates. If the business adopts service agreements, support scheduled visits, reminders, and cancellations from those saved plans. | Follow-up should be based on an actual due date/agreement, not guessed from a universal interval. |
| R9 | Report jobs and collections by date, status, technician, and branch; show invoice balances/aging, parts usage/low stock, and maintenance due from stored records. | Managers need operational views that reconcile to source records rather than invented performance metrics. |
| R10 | Enforce tenant and branch authorization on every read/write; preserve audit history for consequential changes. Provide searchable, responsive, keyboard-usable screens with clear status text and loading, empty, error, and success feedback. | These are system trust and daily-use requirements, not optional visual polish. |

## End-to-end workflow and invariants

`Request (customer + site + unit + symptoms/urgency) → triage/assessment or quote → approved scope → scheduled work order → eligible technician dispatch → arrival/inspection/findings → authorized work + parts usage → completed work history → invoice → payment event(s) + receipt/balance → explicit follow-up date or service agreement.`

Keep the same records linked across status changes. Require valid lifecycle transitions; retain the branch/site/unit identity and an audit record; do not duplicate jobs on retry; do not decrement inventory twice; do not mark an invoice paid because it was sent; do not infer a payment amount from a legacy `PARTIAL` status. Cancellation/rescheduling must retain history and must not orphan assignments, charges, or receipts.

## Optional capabilities, only when the business selects them

- Public/customer portal and online service requests, quote approvals, and self-service payments.
- SMS/email notifications, arrival updates, automated quote/invoice follow-ups, or appointment reminders; each needs an approved provider and customer-contact/consent policy.
- Route/GPS optimization, technician time tracking, signatures, and job photo/document storage.
- Formal service agreements, recurring billing, seasonal/periodic job generation, and contract renewals.
- Supplier catalogs, purchase orders, receiving workflows, branch transfers, truck stock, and barcodes.
- Payment gateway, accounting integration, multi-party billing, job-costing/margin analysis, payroll, or financing.
- Technician qualification records and assignment restrictions where supported by confirmed local rules and business policy.

These are common product capabilities, but add provider costs, privacy/consent obligations, legal/accounting choices, or more complex workflows. They are not silently assumed by this implementation.

## Source evidence

- [ServiceTitan HVAC features](https://www.servicetitan.com/features) documents customer equipment, warranties, service history, work orders, inventory, and reporting.
- [ServiceTitan HVAC dispatch](https://www.servicetitan.com/industries/hvac-software/dispatching) describes technician assignment with job, customer, work-order, and arrival-window context.
- [Housecall Pro HVAC software](https://www.housecallpro.com/industries/hvac-software/) describes scheduling/dispatch, equipment and maintenance history, estimates, invoicing, payment, and office/field workflows.
- [Housecall Pro work-order management](https://www.housecallpro.com/features/work-order-management-software/) traces one work order from request/estimate through dispatch, field notes/photos, and invoice/payment.
- [Jobber HVAC software](https://www.getjobber.com/industries/hvac/) describes service calls, dispatch, technician job details/checklists/photos, customer/job history, estimates, invoices, and payments. Its vendor claims about growth or payment speed are not used as requirements or outcome claims.
- [Jobber checklist guidance](https://help.getjobber.com/en/articles/checklists/) shows configurable safety, inspection, service-authorization, chemical, and equipment forms; it does not establish regulatory compliance.
- [Carrier HVAC cleaning guidance](https://www.carrier.com/us/en/residential/hvac-resources/hvac-cleaning/) lists filters, coils, airflow components, condensate drainage, and the outdoor unit, and says there is no single cleaning schedule for every system.
- [Carrier annual maintenance guidance](https://www.carrier.com/us/en/residential/hvac-resources/hvac-maintenance/) covers thermostat/performance, electrical connections, coils, moving parts, refrigerant, and drains, while qualifying exact work by equipment/model/manufacturer requirements.
- [U.S. DOE Building Science Education HVAC preventative-maintenance module](https://bsesc.energy.gov/training-modules/hvac-preventative-maintenance) provides educational maintenance material; it is a U.S. technical reference, not Philippine regulation.
- [Jobber workflow overview](https://help.getjobber.com/en/articles/jobber-workflow-overview/) and [request basics](https://help.getjobber.com/en/articles/request-basics/) show request → quote/job → invoice flows and the carry-forward of request details.
- [ServiceTitan parts and purchase orders](https://help.servicetitan.com/docs/manage-parts-purchase-orders) describes inventory counts, adjustments, purchase orders, job parts, and location transfers. This supports the inventory lifecycle requirement; enterprise procurement is optional for ARCTIC.

## Decisions to keep explicit

- The user chose four demo branches: Makati, Quezon City, Cavite, and Bulacan. This does not authorize changing a production database or fabricating street addresses, branch leaders, technicians, or customer records.
- Define actual emergency/SLA policy, service catalog/prices, tax/discount/warranty/credit rules, required checklist items and measurement limits, service intervals/agreement coverage, notification channel/consent, payment/accounting providers, and any locally required technician credentials before enabling those policies.
- Carrier, DOE, U.S. EPA, and OSHA references are not applied as Philippine legal requirements. Use manufacturer documentation and the business's qualified technician/SOP for technical tasks and intervals.

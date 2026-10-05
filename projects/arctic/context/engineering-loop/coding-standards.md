# Project-specific coding standards

Use existing Express controllers, Zod boundary validation, central typed errors, Prisma transactions and tenant helpers. Authenticate against current persisted user scope. Branch leaders without a branch fail closed. Decimal owns money arithmetic and JSON serialization uses fixed two-decimal strings. All stock/dispatch/payment guards run inside the transaction protected by corresponding PostgreSQL row locks. Mutation and audit commit together. Preserve immutable terminal records and append-only receipts.

React Query owns server state and cache invalidation. Clear caches at identity changes. Follow pagination for complete selectors and reports; use scoped database aggregates for dashboard. Preserve original route aliases. Shared controls own consistent form labels, focus, loading/errors and reference-derived design tokens. Native dialogs own modal focus trapping and keyboard navigation. Keep dates in Asia/Manila and money in Philippine pesos.

Proof is typecheck, original/new unit tests, isolated PostgreSQL API integration/concurrency tests, production build and actual browser workflow/responsiveness. Compiler/build/status banners alone do not establish user-facing behavior or deployment readiness. Never run a reset or seed against production. Additive migrations keep existing rows and have a reviewed deployment path.

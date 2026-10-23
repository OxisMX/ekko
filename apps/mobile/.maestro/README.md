# Maestro flows (apps/mobile)

UNVERIFIED until a dev build exists (DEP-09): needs Maestro + a Java runtime and a dev build of the app
(`mx.oxis.ekko.dev`) on an emulator/simulator. Nothing here has been run yet.

Run all: `maestro test apps/mobile/.maestro` (from the repo root). One flow: `maestro test apps/mobile/.maestro/e2e-02-recurring-visit.yaml`.

Flows (QA plan §5): E2E-01, 02, 03, 04, 07, 08, 09 (mobile side only; panel/cashier steps are Playwright).
`config.yaml` limits the run to `e2e-*.yaml`; files starting with `_` are sub-flows.

Inputs are passed with `-e KEY=value` (seed data: QA plan §4.2, password in `supabase/seed.sql`):

- `EMAIL`, `PASSWORD`: customer account (U1 verified, U2 unverified, ...).
- `QR_TOKEN`, `QR_TOKEN_2`: 22-char visit tokens, valid 60 s and single use. Generate right before the step with
  `scripts/dev-visit-qr.sh c1`. The scanner has no camera in CI, so flows use the dev-only "Pegar token" (RQ-6, `__DEV__`).
- `MERCHANT_ID`: merchant uuid (flows 04, 07, 08).
- `VERIFY_CODE`: 6-digit email code (flow 04; read it from the local mail inbox).
- `NEW_EMAIL` (flows 01, 09): email not yet registered.

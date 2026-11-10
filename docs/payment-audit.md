# Payment testing and audit

> Historical audit results before fixes. See [Payment audit fixes](payment-fixes.md) for the subsequent implementation and current verification. The legacy defect commands now run repaired regressions and are expected to pass; those regressions are also included in the normal payment matrix.

Audit date: 9 November 2026 (Asia/Manila). Synthetic local data only. No production payment code, APIs, schemas, or payment rules were changed by this audit. Existing workspace application changes were left intact.

## Runbook

```sh
npm ci
npx playwright install webkit
# On machines without Google Chrome:
npx playwright install chromium
npm run build
npm run test:payments:unit
npm run test:payments:baseline
npm run test:payments:e2e
npm run test:payments:defects
npm run test:payments:defects:e2e
npm run lint:queuing
npx eslint playwright.payments.config.ts
npx tsc --noEmit
```

`test:payments` runs the calculation/storage conformance suite and browser conformance matrix. The two `defects` commands deliberately fail while confirmed defects remain. Run both conformance and defect commands for a full audit; a green conformance result alone is not a clean bill of health. The default unfiltered Vitest run also includes the failing defect regression; the unchanged general Playwright configuration discovers the audit specs and their explicit defect cases too. No tests use `skip`, `fixme`, expected-failure annotations, or retries to conceal defects.

Browser conformance excludes tests explicitly named `@defect`; `PAYMENT_AUDIT_DEFECTS=1` selects those same tests with their original failing assertions. General Playwright configuration and existing payment specs are unchanged. The matrix uses desktop Chrome and Chromium/WebKit phone (390×844), iPad portrait (768×1024), and iPad landscape (1024×768), with touch emulation for mobile/tablet projects. Installed Google Chrome supplies Chromium projects when available. WebKit is Safari-engine automation, not a claim of testing physical iOS Safari.

The production server defaults to port 2100. Set `QUEUING_TEST_PORT` to an unused port if needed. Do not rebuild `.next` while a browser run is active. Browser contexts, service-worker caches and IndexedDB are isolated by test. Browser dates use a fixed instant, PHP uses integer centavos, and generated calculation cases use a fixed seed. The edge-workflow spec enables the real production service worker for offline tests; the adapted baseline workflows block it to isolate payment behavior. Each test receives a fresh browser context.

Conformance evidence is written to `test-results/payment-audit/` and defect evidence to `test-results/payment-audit-defects/`: JSON results, failure screenshots/traces, and screenshots from successful workflows. Preserve this directory before another matrix run, since Playwright cleans its configured output directory. Use `npx playwright show-trace PATH/trace.zip` to inspect failures. No real payments or external payment provider calls are involved.

## Coverage matrix

| Requirement | Automated coverage | Oracle / acceptance |
|---|---|---|
| Empty/one/many players, zero costs, all excluded | `calculation.test.ts` | No division errors; null share when no participants; explicit zero charge differs from unassigned |
| Court, tubes, partial shuttles and cent rounding | `calculation.test.ts`, existing `billing.test.ts` | Hand-computed integer totals and half-cent boundaries |
| Standard/discount/fixed/separate/exempt billing | Both calculation suites | Standard/automatic discounts tested as legacy migrations; modern sessions require fixed shared charges |
| Exclusions and attendance independence | Calculation/command suites and baseline | Calculator changes do not rewrite assigned charges or receipts |
| Installments, mixed methods, exact/partial/overpayment | Calculation/command suites and browser workflows | Per-player and total cash/digital/received/balance/credit values agree |
| Generated accounting cases | `calculation.test.ts` | 100 reproducible ledgers compared with independent integer accounting expectations |
| Limits, fractions, NaN/Infinity, references, IDs, timestamp/note limits | `calculation.test.ts` | Invalid commands/imports rejected; inputs remain unchanged |
| Receipt add/edit/delete, immovable ownership, cancelled drafts | Command suite, `edges.spec.ts`, baseline | Correct ledger changes only; cancellation saves nothing |
| Invalid and failed detailed payment drafts | `edges.spec.ts` | Visible validation/save errors; draft retained; failed write leaves ledger unchanged; retry saves once |
| Quick payment, double-clicks and delayed saves | `workflows.spec.ts`, `edges.spec.ts` | No success before commit; exactly one receipt after duplicate click/retry |
| Finalize/reopen/re-finalize and collection after finalization | Command suite, baseline, browser workflows/edges | Ended session + all billing assigned; charges lock; receipts preserved |
| Removal, reset/restart and legacy compatibility | Existing `billing.test.ts` | Payment safeguards, intentional new-session reset, migration and JSON round trips |
| Parallel receipts and duplicate receipt submissions | `commands.test.ts` | Twenty concurrent distinct receipts retained; duplicate ID accepted once |
| Stale edits, edit-after-delete, unrelated edits, stale settlement/bulk/reopen | `commands.test.ts` and baseline | Conflict rejection preserves latest state and revision |
| Aborted write and malformed import | `commands.test.ts` | Actual IndexedDB put failure/transaction abort rolls back; valid saved state survives |
| Cross-tab synchronization and reload | `edges.spec.ts` | Paid rows and saved receipts agree between tabs and after reload |
| Offline collection and offline reload | `edges.spec.ts` | Real service worker restores UI; committed ledger remains identical |
| Search, filters, previews, rounded-up suggestion, billing tags and totals | `workflows.spec.ts`, baseline | UI amounts and selected players match stored charges and receipts |
| Long names, 30-player roster, dark mode, small viewports | `workflows.spec.ts` | No page overflow; preview pagination, readable values and reachable Apply actions |
| Focus and touch controls | `workflows.spec.ts` | Search/trigger focus and Escape behavior; quick payment touch control ≥44px |

`workflows.spec.ts` adapts the preserved baseline scenarios to project-defined viewports instead of overriding every device to phone/desktop sizes. It is intentionally separate from production code and existing tests.

## Confirmed defects

### PAY-001 — stale deletion erases a corrected receipt (P2)

Reproduce with `npm run test:payments:defects`.

1. Save a ₱100 cash receipt.
2. Organizer A reviews that receipt for deletion.
3. Organizer B corrects the same receipt to ₱220 digital.
4. A confirms deletion using the original receipt ID.

Expected: reject the stale deletion and require review of the changed receipt. Actual: deletion succeeds and removes B's correction. `deleteReceipt` carries only an ID and has no original-record/revision check, unlike receipt editing. `defects.test.ts` demonstrates this against real fake-indexedDB transactions, not a mocked calculator. Keep the regression failing until behavior is fixed separately.

### PAY-002 — zero input silently becomes a one-centavo receipt (P2)

Reproduce with `npm run test:payments:defects:e2e -- --project=chrome-desktop` (all seven projects are available by omitting the filter).

1. Open Payments → a player's Details → Record payment.
2. Enter `0` as the PHP amount and select Save payment.

Expected: reject non-positive payment input and preserve the draft without a saved receipt. Actual: the numeric control clamps the amount to its ₱0.01 minimum on blur; Save records a one-centavo cash receipt. The underlying payment schema correctly rejects zero, but never receives the zero entered by the user. The `PAY-002 @defect` browser test asserts that no receipt is saved and the editor stays open. Failure screenshots and traces preserve the UI evidence.

### PAY-003 — Escape loses the Pay trigger focus on phone WebKit (P3)

Reproduce with `npm run test:payments:defects:e2e -- --project=webkit-phone`.

1. Open Payments and select Pay for a player with an outstanding balance.
2. Focus Cash and press Escape to dismiss the bottom drawer.
3. Inspect keyboard focus.

Expected: the drawer closes and focus returns to the originating Pay button. Actual on phone-sized WebKit: the drawer closes but the Pay button is not focused. A minimal `PAY-003 @defect` test reproduces this without recording any money. The end-of-workflow focus assertion from the project-driven copy is moved into this focused defect case; the original baseline spec retains its original assertion. Financial correctness assertions and retry/double-click checks remain in the conformance workflow.

## Verification results

| Check | Result |
|---|---|
| Baseline billing unit suite, before additions | 14 passed |
| Baseline existing Chrome payment UI suite, before additions | 6 passed |
| Expanded billing/calculation/transaction conformance | **85 passed**, including the original 14 and 100 generated ledger scenarios inside one test |
| Full seven-project browser conformance matrix | **61 passed, 2 timed out, 0 skipped**, 63 total; exit code 1 |
| Isolated diagnostic replays of the two timeout scenarios | **2 passed**; original full-run failures retained |
| Confirmed defect unit suite | **1 failed** (PAY-001), intentionally unresolved; exit code 1 |
| Confirmed defect browser matrix | **8 failed, 6 passed, 0 skipped**, 14 total; exit code 1 |
| Production build | Passed |
| Queuing lint and payment-config lint | Passed |
| Standalone `tsc --noEmit` | **Failed** on an existing workspace error in `tests/queuing/advance-booking.test.ts:134`: `sessionStatus = "setup"` is not assignable to `"idle" | "active" | "ended"`. No additional payment-audit type errors reported. Left unchanged. |
| Browser engine availability | No remaining engine-launch blockers; installed WebKit 2370 and used installed Chrome for Chromium projects |
| Physical iPad/iPhone Safari | Not performed; requires a physical device |

Do not combine these into an all-green result. A production build succeeding does not supersede the standalone TypeScript error, retained browser timeouts, or intentionally failing defect regressions.

### Browser results by project

| Project | Conformance passed / total | PAY-002 zero input | PAY-003 focus |
|---|---:|---|---|
| Desktop Chrome | 9/9 | Fails | Passes |
| Phone Chromium | 9/9 | Fails | Passes |
| iPad portrait Chromium | 9/9 | Fails | Passes |
| iPad landscape Chromium | 9/9 | Fails | Passes |
| Phone WebKit | 8/9 | Fails | Fails |
| iPad portrait WebKit | 8/9 | Fails | Passes |
| iPad landscape WebKit | 9/9 | Fails | Passes |

“Fails” in the defect columns means the regression assertion caught the existing defect. Those assertions are not marked as expected failures.

### Intermittent browser failures needing follow-up

- **AUDIT-I01, phone WebKit:** the full collection/settlement workflow timed out waiting for Session Summary → Review payments after confirming Stop session. The captured page still showed Live session. Isolated replay passed in 8.6 seconds. There is insufficient evidence to declare a deterministic payment calculation defect or to dismiss the failure as harmless.
- **AUDIT-I02, portrait iPad WebKit:** the failed-save/retry workflow timed out waiting to select To collect after closing the payment-details dialog. The captured page showed the session workspace without the Payments drawer. Isolated replay passed in 3.6 seconds. Keep this as an unresolved intermittent overlay/lifecycle failure.

Both failures remain in the full-run JSON and have screenshots and traces. No automatic retries, increased timeout, second-click workaround, or assertion weakening was used to mark the full run as passing. The exact quick-payment trigger focus assertion is separately retained in PAY-003.

Evidence:

- [Full conformance JSON](../test-results/payment-audit/results.json)
- [Defect matrix JSON](../test-results/payment-audit-defects/results.json)
- [Conformance console log](../test-results/payment-audit-evidence/conformance.log)
- [Defect browser log](../test-results/payment-audit-evidence/defects-browser.log)
- [Defect unit log](../test-results/payment-audit-evidence/defects-unit.log)
- [Phone timeout trace](../test-results/payment-audit/payment-audit-workflows-co-1db63--corrections-and-settlement-webkit-phone/trace.zip)
- [iPad timeout trace](../test-results/payment-audit/payment-audit-workflows-fa-c5851--without-duplicate-receipts-webkit-ipad-portrait/trace.zip)
- Diagnostic replay JSON: `test-results/payment-audit-investigation-phone/results.json` and `test-results/payment-audit-investigation-ipad/results.json`.

Evidence directories are ignored build artifacts and are available locally after this audit; rerun the commands to regenerate them. Test source, configuration and this report are the durable deliverables.

### Recommended next work (not implemented)

- PAY-001: carry the reviewed receipt snapshot through deletion and reject changed records atomically, as receipt editing already does.
- PAY-002: validate the entered amount before numeric clamping can silently turn an invalid payment into a positive receipt.
- PAY-003: restore the Pay trigger focus after the mobile drawer's close lifecycle finishes.
- Investigate AUDIT-I01/I02 with retained traces and repeated instrumented WebKit runs; complete the physical-Safari checks below before claiming device certification.

## Physical Safari follow-up

Not automated in this audit. On an actual iPad and iPhone in Safari: run collection and correction workflows with the on-screen keyboard, rotate during previews, check focused fields/footer reachability, save offline after warming the production page, reload offline, reopen online, and verify a second organizer's tab updates without duplicate receipts. Also verify date/time display with the device set to Asia/Manila. Record device, OS, Safari version, orientation and result. WebKit emulation cannot certify keyboard, browser-chrome, or physical touch behavior.

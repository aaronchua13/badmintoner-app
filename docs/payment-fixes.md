# Payment audit fixes

Follow-up to [the original payment audit](payment-audit.md). Fixes are local; no deployment or real payment operations were performed.

## Changes

- **PAY-001: guarded deletion.** The delete command now requires the original reviewed receipt, compares all receipt fields inside the IndexedDB transaction, and rejects stale deletion without changing the saved ledger. The confirmation captures the receipt when it opens, keeps errors visible, and requires cancelling/reopening to review another organizer's correction. An unchanged receipt can still be deleted normally.
- **PAY-002: invalid amount validation.** Receipt entry no longer clamps the user's zero/negative/out-of-range input into an accepted amount on blur. The form rejects amounts below ₱0.01 or above ₱10,000,000; the integer-centavo state validation remains in place. Invalid drafts remain open and do not create receipts.
- **PAY-003: focus restoration.** Quick-payment drawers/popovers restore focus after the closing/native focus lifecycle, so WebKit cannot subsequently overwrite the restored Pay-button focus. Successful collection still preserves the existing search-focus behavior.
- **Nested overlay safeguards.** Payments cannot be dismissed through its backdrop or keyboard handler while a child financial dialog is open. Details and session-confirmation dialogs use explicit close/cancel controls; session confirmation cannot cancel while its save is busy. The parent guard tracks visible child rows rather than stale player IDs, so removing a player in another tab cannot leave Payments unclosable.
- **Touch test input.** Phone and tablet projects now activate controls with Playwright taps; desktop Chrome uses mouse clicks. Native same-turn double-click probes are unchanged. This matches each profile's configured input modality without retries or relaxed assertions.
- **TypeScript fixture correction.** The inactive-session test uses the valid `idle` session status instead of `setup`, preserving its inactive-session assertion.

No saved-data migration is required. The internal `deleteReceipt` command gains a required `original: Receipt` field and the queuing action accepts the reviewed receipt instead of only its ID. Calls reaching the updated command handler without a snapshot are rejected safely rather than performing an unchecked deletion. Existing browser tabs must load the updated application to use the new guard.

## Regression coverage

The original defect assertions are now normal passing regressions, included in the default payment runs. No assertions were changed to accept the buggy behavior.

- State-level stale-delete regression preserves the corrected receipt and revision.
- Browser two-tab regression opens deletion first, corrects the receipt in another tab, verifies rejection of the stale confirmation, then reopens and successfully deletes the reviewed correction.
- Zero, negative and over-limit payment-entry tests require visible validation, an open editor and an unchanged ledger.
- Phone WebKit Escape regression requires the original Pay trigger to regain focus.
- Existing billing, activity, receipt-edit, persistence, retry, settlement and offline tests remain enabled. Snapshot arguments were added to existing delete tests to match the guarded command contract.

Commands:

```sh
npm test
npm run test:payments:unit
npm run test:payments:e2e
npm run test:payments:defects
npm run test:payments:defects:e2e
npm run lint:queuing
npx eslint playwright.payments.config.ts
npx tsc --noEmit
npm run build
```

The legacy `defects` command names are retained as regression shortcuts; they are now expected to pass. The browser matrix includes the regressions automatically and uses no skips, expected failures or automatic retries. Install Playwright WebKit first with `npx playwright install webkit` if needed.

## Verification

| Check | Final result |
|---|---|
| Entire Vitest suite (`npm test`) | **187 passed**, 12 files, no failures |
| Payment unit suite, including repaired stale-delete regression | **86 passed** |
| Full browser matrix | **105 passed**, no failures, skips, flaky classifications or automatic retries |
| Desktop Chrome | **15/15 passed** |
| Phone Chromium / WebKit | **15/15 passed each** |
| Portrait iPad Chromium / WebKit | **15/15 passed each** |
| Landscape iPad Chromium / WebKit | **15/15 passed each** |
| Focused Chrome + phone-WebKit defect regressions | **10/10 passed** |
| Queuing lint, payment-config lint, TypeScript | Passed |
| Production build | Passed |

The final full matrix used the final build with normal application animations and genuine touch taps on touch projects. It includes all three repaired defect regressions, invalid-amount boundaries and the cross-tab removal/closability check. Earlier mouse-input WebKit failures are retained as diagnostic evidence; they are not represented as passes. No assertion was relaxed, no double-activation workaround was added, and no retries or skips were used to obtain the final result.

Original audit evidence remains under `test-results/payment-audit*`; follow-up output uses `test-results/payment-fixes-*`.

- [Final browser results JSON](../test-results/payment-fixes-final/results.json)
- [Final browser console log](../test-results/payment-fixes-evidence/browser.log)
- [Final unit log](../test-results/payment-fixes-evidence/unit.log)
- [Final production build log](../test-results/payment-fixes-evidence/build.log)
- [Final TypeScript log](../test-results/payment-fixes-evidence/typecheck.log)
- [Final lint log](../test-results/payment-fixes-evidence/lint.log)

Test-result folders are ignored local artifacts; test source, configuration and these reports are the durable deliverables. After deployment, reload existing organizer tabs to load the new payment guards.

Automated WebKit tests exercise the Safari engine at emulated phone/tablet sizes. Physical iPhone/iPad Safari testing, including the on-screen keyboard and browser chrome, remains a manual check; automated results are not device certification.

## Manual cost and exclusion follow-up

Additional fixes following organizer feedback:

- Cost saves and continuation read the values returned by form validation and calculate the guide from that same snapshot; bulk billing submits its validated amount rather than a previous render's preview state.
- Explicit collection exclusions now set existing bills to No charge, preserving all receipts. Excluding everyone is supported. Existing No charge players remain excluded when opening bulk billing from Billing again.
- Successful application returns to Collect with confirmation. Saving only an estimate explains that review/apply is still required. Synchronous guards prevent duplicate cost or billing submissions.

Verification for this follow-up: **189 unit tests passed**; **35 targeted browser cases passed** across all seven Chrome/Chromium/WebKit profiles. Browser checks include the three new application/exclusion workflows plus existing rounding and large-preview scenarios. Lint, TypeScript and the production build passed. Earlier 105-case results above describe the preceding fixes; they were not rerun for this follow-up.

Evidence: `test-results/payment-application/results.json`. No saved-data migration or deployment was performed.

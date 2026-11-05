# Tablet queuing performance

The queuing workspace keeps the existing layout, touch targets, dialogs, and saved-session format. These changes target repeated main-thread work rather than network requests: sessions and the reusable player database are stored in IndexedDB.

## What changed

- A single wall clock updates visible timer text and time-dependent total-idle sorting. The page shell, forms, menus, billing, and ordinary roster sorting no longer render every second. Clock updates stop in background tabs and catch up when visible again.
- Player rows and court cards use memoized rendering and stable event handlers. Persisted revisions preserve unchanged object references. Saving metadata has a separate subscription, so “Saving…” remains truthful without rendering the workspace.
- Roster, database, and payment search update input text immediately and defer result filtering. Court/queue assignment and billing receipt indexes avoid repeated full-array scans.
- Expensive history, summary, player details, and database content unmount after the closing animation. Database search, selection, edit drafts, summary tabs/sorting/pagination, and history pagination survive reopening. Database rows mount in interruptible batches of 16, with all results eventually present; no pagination or DOM recycling was introduced. Search and bulk actions use the complete filtered dataset immediately.
- Storage validates each persisted input once per transaction, then validates command output. Pure public transitions still validate their inputs. Atomic writes, import validation, stale-command protection, save errors, migration backups, and cross-tab synchronization remain intact. Equal revisions and unchanged metadata do not publish redundant updates.

## Measurements

Local headless production builds on the same Mac, Chromium, 1024 × 1366 viewport, November 6, 2026. The baseline is an untouched `git archive HEAD` snapshot built separately. API ping is stubbed for both runs.

| Fixture | Input p95 before → after | Click feedback p95 before → after | Idle function renders before → after | Idle DOM mutations before → after |
| --- | --- | --- | --- | --- |
| 20 players, 40 matches, 100 saved players | 30.1 → 31.0 ms | 163.8 → 80.1 ms | 1,686 → 48 | 241 → 48 |
| 100 players, 40 matches, 100 saved players | 31.8 → 31.8 ms | 179.9 → 82.3 ms | 3,846 → 72 | 481 → 72 |
| 100 players, 500 matches, 1,000 saved players | 31.2 → 32.7 ms | 1,995.7 → 158.4 ms | 3,846 → 72 | 481 → 72 |

WebKit 27.2 with touch/mobile emulation also met the local budgets:

| Fixture | Portrait input / click p95 | Landscape input / click p95 |
| --- | --- | --- |
| 20 players | 36 / 110 ms | 35 / 108 ms |
| 100 players | 38 / 137 ms | 43 / 133 ms |
| Stress | 32 / 137 ms | 45 / 145 ms |

Idle observations last 3.1 seconds after initialization settles. All optimized scenarios assert zero page-shell renders and zero closed summary/history/database content renders during that interval. Input speed was already below the 100 ms local target; the principal improvements are dialog feedback and background work.

Observed IndexedDB transaction p95 fell from 36.0 / 44.5 / 2,739.6 ms to 7.5 / 9.5 / 17.8 ms across the three fixtures. The baseline includes redundant database-open refresh transactions; the optimized scenario reads only at initialization. These are wall-clock transaction durations, including event-loop delays; the large baseline stress value includes contention from unnecessary dialog rendering. They are not isolated disk speeds or save-command timings. The workflow test separately attaches timings for real saves, including read, input validation, cloning, transition, output validation, write request, structural sharing, and notification.

Input and click measurements use capture listeners and two animation frames to approximate input-to-paint feedback. They are not field INP or measurements of when every result finishes rendering. The React DevTools hook counts committed function work and excludes retained fiber subtrees. Each run attaches JSON measurements to Playwright results. Timing thresholds are opt-in to avoid flaky hardware-dependent CI failures.

## Reproduce

```sh
npm run build
npm test
npm run lint:queuing
npx playwright test
PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/performance.json PERF_ENFORCE=1 npx playwright test --grep 'tablet responsiveness|tablet saves' --reporter=list,json
npx playwright install webkit
PERF_ENFORCE=1 npx playwright test --config playwright.tablet.config.ts
```

The WebKit configuration runs portrait (1024 × 1366) and landscape (1366 × 1024), with touch and mobile emulation. Tests cover search and clearing, combined filters, panel navigation, check-in, queue assignment, match completion, persistence, dialog reopening/drafts, and closed-dialog inactivity. Existing regression tests cover offline reopening, cross-tab changes, storage failures, billing, and ended-session times.

For baseline comparisons, build an untouched source copy, then point the test server at it:

```sh
PERF_BASELINE=1 QUEUING_TEST_PORT=2101 QUEUING_TEST_ROOT=/absolute/path/to/baseline npx playwright test --grep 'tablet responsiveness'
```

When a test defines `window.queuePerf`, opt-in performance measures use the `queue:` prefix and record only phase names and durations. The inclusive `transition` phase contains cloning and output validation. `write-request` measures synchronous request creation/serialization; the transaction sample measures completion. Instrumentation is inactive in ordinary use.

Final checks: production build, 111 unit tests, 64 Chromium browser tests, six WebKit performance scenarios, and both WebKit workflow scenarios passed. Targeted queuing/config lint is clean; full-project lint has one existing unused-variable warning in the club detail page.

## Physical iPad verification

A physical iPad was not available. Headless Chromium/WebKit results establish local regression coverage, not a hardware performance guarantee. Before confirming the live fix, deploy the build through the normal release process, open it online in Safari on the affected iPad, and test both orientations with 20 and 100 players. Repeat typing, clearing, filters, navigation, dialog reopening, check-in, queueing, match completion, and offline reopening; check timers after returning from another app. Record the iPad model, iPadOS version, and any remaining delay. Large database rows continue mounting after the first dialog paint, so also scroll and search while that work is in progress.

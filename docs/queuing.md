# Queuing dashboard

Open `/queuing` (`/queing` redirects here). The dashboard defaults to Compact; the Density control switches to Comfortable without resetting search, filters, selected views, or open forms. The preference is stored separately from session data.

## Layout and session workflow

- Desktop: courts come first in the left panel, followed by Up next; the roster occupies the wider right panel. Courts use at most two columns from 900 px upward and one column below that. Courts, queue and roster scroll independently. When matches are queued, courts use one-third of the left panel height and the queue uses the rest. The first queue entry is marked Next.
- Tablet: roster first, with a Queue / Courts panel below.
- Phone: Players / Queue / Courts navigation opens the roster first and preserves each view and its scroll position.
- Add players and courts, start the session, then assign four players and start a match. Queue entries preserve their two teams even when incomplete.
- Complete matches with a winner and optional scores, or stop them with an optional reason. Both scores must be supplied together; zero is valid.
- All running matches must finish or stop before the session can end. New session retains the roster and courts; Reset clears the session. Neither removes the reusable player database.

## Browser-local storage

`state/transitions.ts` defines typed, pure commands. `state/model.ts` validates imports and state invariants. `state/storage.ts` applies commands inside IndexedDB read/write transactions against the latest committed session. The session and reusable player library share one record so adding a player updates both atomically. `state/store.ts` publishes committed revisions to React and other tabs through BroadcastChannel; focusing a tab also refreshes it.

On first use, valid `badminton_queue_data_v2` (or legacy `badminton_queue_data`) and `badminton_players_db` localStorage values are migrated. The originals remain untouched as backups and are never reread after migration. Malformed legacy data reports an error instead of silently overwriting it. Browser data is not cloud backup; use Export Session for copies of sessions you need to retain.

Exports retain the session JSON structure with `schemaVersion: 4`. Valid legacy files without this field remain supported. Import validation permits historical references to removed players but rejects invalid live assignments. Import is unavailable during an active session and rejects a replacement if another tab changed the saved record meanwhile.

## Offline behavior

Offline registration runs in production only. The worker caches the `/queuing` HTML shell and its static assets, excludes API and RSC requests, limits cached assets to 160, and removes only caches prefixed `badminton-queue-`. Open the production page online once before reopening offline. Session → Refresh offline files repairs those caches without deleting session data.

## Verification

```sh
npm test
npm run lint:queuing
npm run build
npm run test:e2e
```

The browser suite starts a temporary production server on port 2100. On macOS it uses installed Google Chrome; otherwise install Playwright Chromium with `npx playwright install chromium`. Tests use isolated browser contexts and never touch your normal browser profile. Screenshots and traces are saved under ignored `test-results/`.

Coverage includes concurrent edits, migration and storage errors, invalid imports, score handling, team assignments, session-end blocking, the full match workflow, offline reload, density persistence, touch targets, and layouts at 375, 768, 1024, and 1440 px.

Up next can be minimized to its heading, match count, and first match; on desktop this gives the courts the remaining left-panel height. Expanding shows the remaining queued matches. The next match stays pinned while scrolling the desktop queue. When empty, the queue body renders nothing. Creating a match expands Up next automatically. Roster filters and sorting live in the Filters popover beside search, preserving the selected settings when closed. Compact mode uses tighter card padding, shorter rows, and smaller desktop card controls; touch targets remain at least 44 px.

After a player is successfully added to a queue, roster search clears and receives focus so you can type the next name immediately. Filters and sorting stay selected. Cancelling the dialog or a failed addition preserves the current search.

Removal and replacement actions ask for confirmation before saving: removing a session player or court, clearing court or queue assignments, removing queued matches, deleting reusable player entries, importing a replacement session, and moving a player out of an existing court assignment. Marking an assigned player away also confirms the assignment removal. Cancel leaves the data untouched; failed actions keep the confirmation open and show the error. Reset, restart, stop, and transfer retain their existing confirmation dialogs.

Automatic court assignment is disabled, including for saved or imported sessions that previously enabled it. Court assignment is always manual. Current idle indicators turn amber at 15 minutes and red at 20 minutes, including waits before a first game. Away and playing players are excluded; accumulated idle statistics retain their previous rules.

Stopping a match does not require a reason. On touch devices, roster search, status, view controls and filters share a 44 px control height; queue team labels remain aligned for empty and populated teams.

## Check-in

New session players start as Not arrived. The organizer uses Check in on the roster to mark arrival; search then clears and receives focus for the next name. Only checked-in, available players can enter a queue or court. The header shows present and not-arrived counts, and the status filter includes Present and Not arrived. Away is a break for somebody who is already present and does not reduce the present count. Check-in timestamps are session-specific and shared across tabs.

Undo check-in requires confirmation and removes pending queue/court assignments. It is unavailable while a player is playing. Repeated check-in does not reset the arrival timestamp. New session resets attendance. Existing sessions and legacy imports without attendance fields remain present to preserve existing matches and assignments. Explicit attendance is preserved in exports/imports. Current wait starts from arrival or session start, whichever is later.

## Result and concurrency safeguards

Entering both scores selects the higher-scoring team automatically; ties and incomplete score pairs cannot be saved. Without scores, select a winner manually. Canceling Finish Match clears the draft; failed saves retain it.

Payment edits and court transfers compare the original record or source lineup against the latest saved data. If another tab changes it, the action is rejected without overwriting anything. Close and reopen the dialog to review the latest data. Unrelated changes do not block payment edits.

Waiting includes only checked-in, active players without court or queue assignments. Total idle uses the same calculation in the roster, player details, sorting, and summary, and stops advancing when the session ends. Existing first-game and away-time accounting rules are preserved.

## Player logs

Open a player’s details and select Player Logs to see timestamped activity for the current session, newest first, with ten entries per page. Entries cover check-in and undo, away/available changes, queue assignments and order, court assignments and transfers, corrected lineups, match starts/results/stops, payment additions/edits/deletions, billing changes, and session start/end. Saved entries retain their original details when courts are renamed or payments are corrected.

Logs are committed atomically with each successful action, shared across tabs, retained on reload, and included in session exports/imports. Failed actions and unchanged values produce no entries. New session and Reset clear logs; export first to retain a previous session. Historical references to removed players remain in exports. Older session files remain supported and start with empty logs; past activity is not reconstructed. Exports now use schema version 4.

Idle courts with staged players offer **Move all to queue** in court options. Confirming appends one match to Up next, keeps both teams (including incomplete teams), and empties the court. Empty idle courts offer **Assign from queue**, which shows queued teams and availability. Assigning moves the selected lineup onto the court without starting it; unavailable or currently playing players must become available first. To replace a staged lineup, move it to the queue and then assign another match.

## Tablet performance

See [queuing-performance.md](queuing-performance.md) for the rendering/storage changes, production measurements, repeatable Chromium and WebKit scenarios, and the physical-iPad verification steps.

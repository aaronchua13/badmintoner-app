# Optional cloud queuing

Next.js owns `/api/queuing/cloud`. No changes are required in badmintoner-api. Existing player/admin accounts and cookies remain independent of the organizer's Supabase account.

## Rollout

1. Apply `supabase/migrations/20261105085040_queue_cloud_hub.sql` using the Supabase migration workflow. It adds six owner-scoped tables and restricted RPCs. Existing data is untouched.
2. Run `supabase/tests/queue-cloud-policies.sql` as database administrator. Temporary fixtures are rolled back. Run Supabase security and performance advisors.
3. In Authentication → Sign In / Providers, enable Email/password signup and turn **Confirm email** off. Leave anonymous sign-ins and manual account linking off. In Authentication → Emails → Security notifications, disable every optional notification email, including password-change notifications. Do not configure public recovery or OTP flows for this application.
4. Set these variables in Next.js, then restart/deploy:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
   # Only after an administrator verifies every no-email setting above:
   QUEUING_CLOUD_NO_EMAIL_VERIFIED=true
   ```

   Never use a service-role key here. Registration requires the explicit verification flag plus live public Auth settings showing email autoconfirm. Missing settings disable signup. Notification settings are admin-only; verify them again after Auth configuration changes.
5. Smoke-test registration in a controlled test account, login/logout, and password changes requiring the current password. Confirm no email delivery, separate `queue-cloud-auth` cookies, private uncached responses, and isolation from another account.

Ship additive database changes before enabling registration. Missing configuration, expired authentication, and cloud failures leave standalone queuing available.

## Organizer workflow and storage

Open **Session tools** for sessions, account settings, backups, templates, and player history. Device tools and TV mode work without an account. Signup generates a cryptographically random 20-character initial password. Copy or download it and acknowledge saving it before signup. Credentials remain in temporary form memory and the explicitly downloaded copy; closing the form clears them. Credentials are never stored in queue data or logs.

Login does not upload or replace the device session. Explicitly save a local session or open a listed cloud session. Saving creates a new cloud identity while retaining the device original. Same-name library collisions require explicit linking; imported players are linked manually. Templates require linked library players.

IndexedDB commits come first. Uploads debounce for 1.5 seconds, with a five-second maximum delay. Persisted mutation IDs, revisions, documents, and snapshot lists remain immutable until acknowledged. Newer edits stay pending. Visible pages poll session versions every five seconds; hidden pages pause. Web Locks serialize tab workers with an IndexedDB lease fallback. Account-scoped pending uploads survive reload, reset, and switching accounts without uploading to another owner.

Conflicts preserve both documents and pause that resource. Cloud/device/separate-copy choices save a recovery snapshot before replacement. A remotely deleted archive is not silently recreated: its device draft remains, and explicitly saving creates a separate recovery copy. Recovery copies are excluded from history until adopted.

Completed primary sessions are archives; later settlement updates the same ID. Reset/new/import/template/restore atomically snapshot the outgoing session before replacement. Snapshot failure aborts replacement. Retain 20 snapshots per session, keeping unuploaded snapshots until durable upload. Server writes also snapshot the previous committed revision atomically. Archive deletion retains recovery snapshots.

Undo keeps 20 reversible actions, checks expected state, and appends reversal logs without removing existing entries. Dependent changes invalidate previous undo. Running/completed matches and payments retain their correction flows.

The local TV route `/queuing?display=tv` uses the cached offline shell. Public QR links expose only title, status, court names, teams, upcoming matches, and update timestamps through a token-checked projection RPC. Public displays poll every five seconds while visible, show stale content on connection loss, and hide it after revocation/404. Already viewed information cannot be erased from an offline spectator's device.

History counts primary completed archives using stable library identities. Unlinked players remain session-specific. Stopped matches are excluded from completed-game counts. **Idle time per game** is total recorded idle divided by completed games, retaining the existing idle policy.

## Administrator password recovery

No public password-reset endpoint or recovery email flow is exposed.

1. Verify the organizer's identity through your normal process. Locate the exact UUID in Supabase Authentication → Users.
2. From a private administrative environment, use Supabase `auth.admin.updateUserById` to set a strong temporary password. Keep the admin secret outside public application variables. Pass the password in memory; never put it in shell arguments, scripts, tickets, or logs. Do not use the email recovery action.
3. Revoke existing sessions through Supabase admin sign-out tooling. Existing access tokens can remain valid until expiry; account for that during compromise response. Verify success without logging credentials/tokens.
4. Deliver the temporary password through a verified private channel. The organizer signs in and changes it in Session tools → Account using the current password.

References: [admin update user](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid), [password authentication](https://supabase.com/docs/guides/auth/passwords).

## Verification

Run sequentially:

```sh
npm test
npm run lint:queuing
npx eslint 'app/api/queuing/cloud/[...path]/route.ts' lib/queue-cloud
npm run build
npm run test:e2e
```

After migration, run the rollback-only SQL policy suite:

```sh
psql "$QUEUE_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/queue-cloud-policies.sql
```

SQL coverage includes ownership, anonymous denial, token publication/revocation, CAS, retries, retention, archive updates, and recoverable deletion. Unit/browser coverage includes offline pending uploads, lost responses, in-flight edits/backups, conflicts, authentication expiry, account switching, generated-password acknowledgment/nonpersistence, templates, restoration, and public display revocation. Live Auth configuration and email delivery still need a controlled project smoke test.

-- Run after migration as the database administrator. Every fixture is rolled back.
begin;
create function pg_temp.check_that(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; end $$;
insert into auth.users(id) values('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select pg_temp.check_that((public.queue_save_session(
 '20000000-0000-4000-8000-000000000001',0,'30000000-0000-4000-8000-000000000001',
 '{"schemaVersion":4,"sessionStatus":"active","players":[{"id":"p","name":"Alex"}],"courts":[{"name":"Court 1","status":"idle","startTime":null,"players":[]}],"queue":[{"team1":["p"],"team2":[]}],"billing":{"receipts":[{"note":"SECRET_PAYMENT"}]},"playerLogs":[{"message":"SECRET_LOG"}]}',
 '{"title":"Policy test","kind":"primary","links":{},"undo":[]}', '[]')->>'version')::int=1,'initial version');
-- Same mutation is replay-safe, even with an old expected version.
select pg_temp.check_that((public.queue_save_session(
 '20000000-0000-4000-8000-000000000001',0,'30000000-0000-4000-8000-000000000001',
 '{"schemaVersion":4,"players":[],"courts":[],"queue":[]}', '{"title":"Must not replace"}', '[]')->>'version')::int=1,'retry returns original acknowledgment');
select pg_temp.check_that((select metadata->>'title'='Policy test' from public.queue_sessions),'retry preserved data');
do $$ begin
 perform public.queue_save_session('20000000-0000-4000-8000-000000000001',0,gen_random_uuid(),'{"schemaVersion":4,"players":[],"courts":[],"queue":[]}','{}','[]');
 raise exception 'FAIL: stale update succeeded';
exception when serialization_failure then null; end $$;
select public.queue_share_session('20000000-0000-4000-8000-000000000001',repeat('a',43));
select pg_temp.check_that(public.queue_read_display(repeat('a',43))::text not like '%SECRET_%','projection excludes private data');
select pg_temp.check_that(public.queue_read_display(repeat('a',43))->'courts'->0->'team1'='[]'::jsonb,'empty teams are arrays');
select pg_temp.check_that(public.queue_read_display(repeat('a',43))->'queue'->0->'team1'='["Alex"]'::jsonb,'projection resolves names');
select public.queue_save_workspace(0,'30000000-0000-4000-8000-000000000002','{"library":[],"templates":[],"identities":{}}');
select pg_temp.check_that((public.queue_save_workspace(0,'30000000-0000-4000-8000-000000000002','{"library":[],"templates":[],"identities":{}}')->>'version')::int=1,'workspace retry safety');
select public.queue_save_workspace(1,gen_random_uuid(),'{"library":[],"templates":[],"identities":{}}');
select pg_temp.check_that((select count(*)=1 from public.queue_workspace_snapshots),'workspace replacement snapshot');
do $$ begin
 update public.queue_sessions set owner_id='10000000-0000-4000-8000-000000000002';
 raise exception 'FAIL: direct table write succeeded';
exception when insufficient_privilege then null; end $$;
do $$ begin
 perform public.queue_save_workspace(null,gen_random_uuid(),'{"library":[],"templates":[],"identities":{}}');
 raise exception 'FAIL: null precondition accepted';
exception when raise_exception then if sqlerrm like 'FAIL:%' then raise; end if; end $$;
do $$ declare i int; d jsonb; m jsonb; begin
 select data,metadata into d,m from public.queue_sessions;
 for i in 1..25 loop perform public.queue_save_session('20000000-0000-4000-8000-000000000001',i,gen_random_uuid(),d,m,'[]'); end loop;
end $$;
select pg_temp.check_that((select count(*)=20 from public.queue_snapshots),'snapshot retention');
select pg_temp.check_that((select count(*)=1 and max(version)=26 from public.queue_sessions),'settlement updates same archive');
-- Different organizer cannot list or mutate the first organizer's resources.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select pg_temp.check_that((select count(*)=0 from public.queue_sessions),'session ownership');
select pg_temp.check_that((select count(*)=0 from public.queue_workspaces),'workspace ownership');
select pg_temp.check_that((select count(*)=0 from public.queue_workspace_snapshots),'workspace snapshot ownership');
select pg_temp.check_that((select count(*)=0 from public.queue_snapshots),'snapshot ownership');
select pg_temp.check_that((select count(*)=0 from public.queue_displays),'share token ownership');
select pg_temp.check_that((select count(*)=0 from public.queue_write_receipts),'receipt ownership');
do $$ begin
 perform public.queue_share_session('20000000-0000-4000-8000-000000000001',repeat('b',43));
 raise exception 'FAIL: cross-owner sharing succeeded';
exception when insufficient_privilege then null; end $$;
do $$ begin
 perform public.queue_delete_session('20000000-0000-4000-8000-000000000001');
 raise exception 'FAIL: cross-owner deletion succeeded';
exception when insufficient_privilege then null; end $$;
do $$ begin
 perform public.queue_save_session('20000000-0000-4000-8000-000000000001',0,gen_random_uuid(),'{"schemaVersion":4,"players":[],"courts":[],"queue":[]}','{}','[]');
 raise exception 'FAIL: cross-owner overwrite succeeded';
exception when serialization_failure then null; end $$;
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select pg_temp.check_that(public.queue_read_display(repeat('a',43))->>'title'='Policy test','anonymous token display');
select pg_temp.check_that(public.queue_read_display(repeat('b',43)) is null,'unknown token denied');
do $$ begin perform data from public.queue_sessions; raise exception 'FAIL: anonymous private read succeeded'; exception when insufficient_privilege then null; end $$;
do $$ begin perform public.queue_delete_session('20000000-0000-4000-8000-000000000001'); raise exception 'FAIL: anonymous write succeeded'; exception when insufficient_privilege then null; end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select public.queue_share_session('20000000-0000-4000-8000-000000000001',null);
select pg_temp.check_that(public.queue_read_display(repeat('a',43)) is null,'revoked token denied');
select public.queue_delete_session('20000000-0000-4000-8000-000000000001');
select pg_temp.check_that((select count(*)=0 from public.queue_sessions),'archive deleted');
select pg_temp.check_that((select count(*)=20 from public.queue_snapshots),'deleted archive recoverable');
rollback;

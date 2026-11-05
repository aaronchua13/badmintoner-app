-- Additive queue-cloud resources. QueueData remains an opaque versioned JSON document.
create schema if not exists queue_private;
revoke all on schema queue_private from public;
create table public.queue_sessions (
 id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
 version bigint not null default 0, data jsonb not null check(jsonb_typeof(data)='object'),
 metadata jsonb not null check(jsonb_typeof(metadata)='object'),
 status text generated always as (data->>'sessionStatus') stored,
 updated_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create index queue_sessions_owner_updated on public.queue_sessions(owner_id, updated_at desc);
create index queue_sessions_owner_status on public.queue_sessions(owner_id,status,id);
create table public.queue_workspaces (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 version bigint not null default 0, payload jsonb not null check(jsonb_typeof(payload)='object'), updated_at timestamptz not null default now()
);
create table public.queue_workspace_snapshots (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 payload jsonb not null, version bigint not null, created_at timestamptz not null default now()
);
create index queue_workspace_snapshots_owner on public.queue_workspace_snapshots(owner_id,created_at desc);
create table public.queue_snapshots (
 id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
 session_id uuid not null, data jsonb not null, metadata jsonb not null, reason text not null,
 created_at timestamptz not null default now()
);
create index queue_snapshots_owner_session on public.queue_snapshots(owner_id,session_id,created_at desc);
create table public.queue_displays (
 session_id uuid primary key references public.queue_sessions(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 token text not null, token_hash text not null unique, payload jsonb not null,
 updated_at timestamptz not null default now()
);
create index queue_displays_owner on public.queue_displays(owner_id);
create table public.queue_write_receipts (
 owner_id uuid not null references auth.users(id) on delete cascade,
 mutation_id uuid not null, resource_id text not null, version bigint not null, created_at timestamptz not null default now(),
 primary key(owner_id,mutation_id)
);
create index queue_receipts_resource on public.queue_write_receipts(owner_id,resource_id,created_at desc);
alter table public.queue_sessions enable row level security;
alter table public.queue_workspaces enable row level security;
alter table public.queue_workspace_snapshots enable row level security;
alter table public.queue_snapshots enable row level security;
alter table public.queue_displays enable row level security;
alter table public.queue_write_receipts enable row level security;
create policy queue_sessions_owner on public.queue_sessions for select to authenticated using(owner_id=(select auth.uid()));
create policy queue_workspaces_owner on public.queue_workspaces for select to authenticated using(owner_id=(select auth.uid()));
create policy queue_workspace_snapshots_owner on public.queue_workspace_snapshots for select to authenticated using(owner_id=(select auth.uid()));
create policy queue_snapshots_owner on public.queue_snapshots for select to authenticated using(owner_id=(select auth.uid()));
create policy queue_displays_owner on public.queue_displays for select to authenticated using(owner_id=(select auth.uid()));
create policy queue_receipts_owner on public.queue_write_receipts for select to authenticated using(owner_id=(select auth.uid()));
revoke all on public.queue_sessions,public.queue_workspaces,public.queue_workspace_snapshots,public.queue_snapshots,public.queue_displays,public.queue_write_receipts from anon,authenticated;
grant select on public.queue_sessions,public.queue_workspaces,public.queue_workspace_snapshots,public.queue_snapshots,public.queue_displays,public.queue_write_receipts to authenticated;

-- Only this allowlist is ever returned to anonymous spectators.
create function queue_private.projection(d jsonb, m jsonb, stamp timestamptz) returns jsonb
language sql immutable set search_path='' as $$
select jsonb_build_object('title',left(coalesce(m->>'title','Session'),200),'status',d->>'sessionStatus','updatedAt',extract(epoch from stamp)*1000,
 'courts',coalesce((select jsonb_agg(jsonb_build_object('name',c->>'name','status',c->>'status','startTime',c->'startTime',
 'team1',coalesce((select jsonb_agg((select p->>'name' from jsonb_array_elements(d->'players') p where p->>'id'=v #>> '{}')) from jsonb_array_elements(c->'players') with ordinality a(v,i) where i<=2),'[]'::jsonb),
 'team2',coalesce((select jsonb_agg((select p->>'name' from jsonb_array_elements(d->'players') p where p->>'id'=v #>> '{}')) from jsonb_array_elements(c->'players') with ordinality a(v,i) where i>2),'[]'::jsonb))) from jsonb_array_elements(d->'courts') c),'[]'::jsonb),
 'queue',coalesce((select jsonb_agg(jsonb_build_object(
 'team1',coalesce((select jsonb_agg((select p->>'name' from jsonb_array_elements(d->'players') p where p->>'id'=v #>> '{}')) from jsonb_array_elements(q->'team1') a(v)),'[]'::jsonb),
 'team2',coalesce((select jsonb_agg((select p->>'name' from jsonb_array_elements(d->'players') p where p->>'id'=v #>> '{}')) from jsonb_array_elements(q->'team2') a(v)),'[]'::jsonb))) from jsonb_array_elements(d->'queue') q),'[]'::jsonb));
$$;

create function queue_private.save_session(p_id uuid,p_expected bigint,p_mutation uuid,p_data jsonb,p_meta jsonb,p_backups jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r public.queue_sessions; acknowledged bigint; b jsonb; result_version bigint;
begin
 if u is null then raise exception 'Not authenticated' using errcode='42501'; end if;
 if p_id is null or p_mutation is null or p_expected is null or p_expected<0 then raise exception 'Missing write preconditions'; end if;
 if jsonb_typeof(p_data) is distinct from 'object' or p_data->>'schemaVersion' is distinct from '4' or jsonb_typeof(p_data->'players') is distinct from 'array' or jsonb_typeof(p_data->'courts') is distinct from 'array' or jsonb_typeof(p_data->'queue') is distinct from 'array' or jsonb_typeof(p_meta) is distinct from 'object' then raise exception 'Invalid session document'; end if;
 if octet_length(p_data::text)+octet_length(p_meta::text)>4194304 then raise exception 'Session is too large'; end if;
 -- Same-owner advisory lock also serializes creation and duplicate requests.
 perform pg_advisory_xact_lock(hashtextextended(u::text||':'||p_id::text,0));
 select version into acknowledged from public.queue_write_receipts where owner_id=u and mutation_id=p_mutation and resource_id=p_id::text;
 if found then return jsonb_build_object('version',acknowledged,'duplicate',true); end if;
 select * into r from public.queue_sessions where id=p_id and owner_id=u for update;
 if not found then
  if p_expected<>0 or exists(select 1 from public.queue_sessions where id=p_id) then raise exception 'Version conflict' using errcode='40001'; end if;
  insert into public.queue_sessions(id,owner_id,data,metadata) values(p_id,u,p_data,p_meta) returning * into r;
 end if;
 if r.version<>p_expected then raise exception 'Version conflict' using errcode='40001'; end if;
 -- A server snapshot protects every replacement of an existing cloud revision.
 if r.version>0 then
  insert into public.queue_snapshots(id,owner_id,session_id,data,metadata,reason) values(gen_random_uuid(),u,p_id,r.data,r.metadata,'Before cloud revision '||r.version);
 end if;
 for b in select value from jsonb_array_elements(coalesce(p_backups,'[]'::jsonb)) loop
  if jsonb_typeof(b->'session')<>'object' or jsonb_typeof(b->'metadata')<>'object' then raise exception 'Invalid backup'; end if;
  insert into public.queue_snapshots(id,owner_id,session_id,data,metadata,reason,created_at)
   values((b->>'id')::uuid,u,p_id,b->'session',b->'metadata',left(b->>'reason',200),to_timestamp((b->>'at')::numeric/1000)) on conflict(id) do nothing;
 end loop;
 result_version:=r.version+1;
 update public.queue_sessions set data=p_data,metadata=p_meta,version=result_version,updated_at=now() where id=p_id and owner_id=u;
 update public.queue_displays set payload=queue_private.projection(p_data,p_meta,now()),updated_at=now() where session_id=p_id and owner_id=u;
 insert into public.queue_write_receipts(owner_id,mutation_id,resource_id,version) values(u,p_mutation,p_id::text,result_version);
 delete from public.queue_snapshots where id in (select id from public.queue_snapshots where owner_id=u and session_id=p_id order by created_at desc,id desc offset 20);
 delete from public.queue_write_receipts where owner_id=u and resource_id=p_id::text and mutation_id in (select mutation_id from public.queue_write_receipts where owner_id=u and resource_id=p_id::text order by created_at desc offset 200);
 return jsonb_build_object('version',result_version,'updatedAt',now());
end $$;
create function public.queue_save_session(p_id uuid,p_expected bigint,p_mutation uuid,p_data jsonb,p_meta jsonb,p_backups jsonb default '[]') returns jsonb
language sql security invoker set search_path='' as $$ select queue_private.save_session(p_id,p_expected,p_mutation,p_data,p_meta,p_backups); $$;

create function queue_private.save_workspace(p_expected bigint,p_mutation uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); v bigint; acknowledged bigint;
begin
 if u is null then raise exception 'Not authenticated' using errcode='42501'; end if;
 if p_mutation is null or p_expected is null or p_expected<0 then raise exception 'Missing write preconditions'; end if;
 if jsonb_typeof(p_payload)<>'object' or jsonb_typeof(p_payload->'library') is distinct from 'array' or jsonb_typeof(p_payload->'templates') is distinct from 'array' or jsonb_typeof(p_payload->'identities') is distinct from 'object' then raise exception 'Invalid workspace'; end if;
 if octet_length(p_payload::text)>4194304 then raise exception 'Workspace is too large'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||':workspace',0));
 select version into acknowledged from public.queue_write_receipts where owner_id=u and mutation_id=p_mutation and resource_id='workspace';
 if found then return jsonb_build_object('version',acknowledged,'duplicate',true); end if;
 select version into v from public.queue_workspaces where owner_id=u for update;
 if not found then v:=0; end if;
 if v<>p_expected then raise exception 'Version conflict' using errcode='40001'; end if;
 if v>0 then
  insert into public.queue_workspace_snapshots(owner_id,payload,version) select u,payload,version from public.queue_workspaces where owner_id=u;
 end if;
 insert into public.queue_workspaces(owner_id,version,payload) values(u,v+1,p_payload)
 on conflict(owner_id) do update set version=v+1,payload=p_payload,updated_at=now();
 insert into public.queue_write_receipts(owner_id,mutation_id,resource_id,version) values(u,p_mutation,'workspace',v+1);
 delete from public.queue_write_receipts where owner_id=u and resource_id='workspace' and mutation_id in (select mutation_id from public.queue_write_receipts where owner_id=u and resource_id='workspace' order by created_at desc offset 200);
 delete from public.queue_workspace_snapshots where id in (select id from public.queue_workspace_snapshots where owner_id=u order by created_at desc,id desc offset 20);
 return jsonb_build_object('version',v+1,'updatedAt',now());
end $$;
create function public.queue_save_workspace(p_expected bigint,p_mutation uuid,p_payload jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select queue_private.save_workspace(p_expected,p_mutation,p_payload); $$;

create function queue_private.share_session(p_id uuid,p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r public.queue_sessions;
begin
 if u is null then raise exception 'Not authenticated' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||':'||p_id::text,0));
 select * into r from public.queue_sessions where id=p_id and owner_id=u;
 if not found then raise exception 'Session not found' using errcode='42501'; end if;
 if p_token is null then delete from public.queue_displays where session_id=p_id and owner_id=u; return '{}'::jsonb; end if;
 if length(p_token)<40 or length(p_token)>100 then raise exception 'Invalid share token'; end if;
 insert into public.queue_displays(session_id,owner_id,token,token_hash,payload)
 values(p_id,u,p_token,encode(extensions.digest(p_token,'sha256'),'hex'),queue_private.projection(r.data,r.metadata,now()))
 on conflict(session_id) do update set token=p_token,token_hash=excluded.token_hash,payload=excluded.payload,updated_at=now();
 return jsonb_build_object('token',p_token);
end $$;
create function public.queue_share_session(p_id uuid,p_token text default null) returns jsonb
language sql security invoker set search_path='' as $$ select queue_private.share_session(p_id,p_token); $$;
-- Deliberately anonymous, token-authorized, projection-only. No private document reads.
create function queue_private.read_display(p_token text) returns jsonb
language sql stable security definer set search_path='' as $$
 select payload from public.queue_displays where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and length(p_token) between 40 and 100;
$$;
create function public.queue_read_display(p_token text) returns jsonb
language sql stable security invoker set search_path='' as $$ select queue_private.read_display(p_token); $$;

create function queue_private.delete_session(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); begin
 if u is null then raise exception 'Not authenticated' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||':'||p_id::text,0));
 if not exists(select 1 from public.queue_sessions where id=p_id and owner_id=u) then raise exception 'Session not found' using errcode='42501'; end if;
 insert into public.queue_snapshots(id,owner_id,session_id,data,metadata,reason) select gen_random_uuid(),owner_id,id,data,metadata,'Before archive deletion' from public.queue_sessions where id=p_id and owner_id=u;
 delete from public.queue_snapshots where id in (select id from public.queue_snapshots where owner_id=u and session_id=p_id order by created_at desc,id desc offset 20);
 delete from public.queue_displays where session_id=p_id and owner_id=u;
 delete from public.queue_sessions where id=p_id and owner_id=u;
 -- Recovery snapshots deliberately remain available after archive deletion.
end $$;
create function public.queue_delete_session(p_id uuid) returns void
language sql security invoker set search_path='' as $$ select queue_private.delete_session(p_id); $$;

revoke all on all functions in schema queue_private from public,anon,authenticated;
grant usage on schema queue_private to anon,authenticated;
grant execute on function queue_private.save_session(uuid,bigint,uuid,jsonb,jsonb,jsonb),queue_private.save_workspace(bigint,uuid,jsonb),queue_private.share_session(uuid,text),queue_private.delete_session(uuid) to authenticated;
grant execute on function queue_private.read_display(text) to anon,authenticated;
revoke all on function public.queue_save_session(uuid,bigint,uuid,jsonb,jsonb,jsonb),public.queue_save_workspace(bigint,uuid,jsonb),public.queue_share_session(uuid,text),public.queue_delete_session(uuid),public.queue_read_display(text) from public,anon,authenticated;
grant execute on function public.queue_save_session(uuid,bigint,uuid,jsonb,jsonb,jsonb),public.queue_save_workspace(bigint,uuid,jsonb),public.queue_share_session(uuid,text),public.queue_delete_session(uuid) to authenticated;
grant execute on function public.queue_read_display(text) to anon,authenticated;

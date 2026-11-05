"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Alert, Button, Checkbox, Drawer, Form, Input, Modal, QRCode, Select, Space, Table, Tabs, Tag, Typography, message } from "antd";
import { getSnapshot, getServerSnapshot, initialize, subscribe } from "../state/store";
import { ensureHub, activeRecord, playerHistory, scopeKey, type RecoverySnapshot } from "../state/hub";
import { cloudRequest, refreshCloudAuth, resolveSessionConflict, setCloudUser, startCloudSync, useCloudState, type CloudUser } from "../cloud/sync";
import { adoptRecovery, connectCurrent, deleteTemplate, linkPlayer, localChange, openCloudSession, openDeviceSession, readCloudSnapshots, renameSession, resolveWorkspace, restoreCopy, savePlayerIdentity, saveTemplate, undoLast, applySavedTemplate, restoreWorkspaceCopy, restoreCloudWorkspacePayload } from "../cloud/actions";
import { generateInitialPassword } from "../cloud/password";
import { money } from "../state/billing";
import { formatDuration } from "../utils";
import { useConfirmation } from "../hooks/useConfirmation";

function download(name: string, contents: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: "text/plain" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
type CloudSummary = { id: string; version: number; status: string; updated_at: string; metadata: { title: string; kind: string } };
export default function CloudTools() {
  const cloud = useCloudState();
  return <CloudToolsBody key={cloud.user?.id ?? "offline"} />;
}
function CloudToolsBody() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const cloud = useCloudState();
  const hub = snapshot.data.hub, record = activeRecord(snapshot.data);
  const workspace = hub?.workspaces[scopeKey(record?.ownerId ?? null)];
  const [openedSession, setOpenedSession] = useState<string | null>(null);
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [failure, setFailure] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [password, setPassword] = useState<string | null>(null), [acknowledged, setAcknowledged] = useState(false);
  const [tab, setTab] = useState("sessions"), [templateName, setTemplateName] = useState("");
  const [sessionTitle, setSessionTitle] = useState(""), [linkNames, setLinkNames] = useState(false);
  const [sessions, setSessions] = useState<CloudSummary[]>([]), [offset, setOffset] = useState(0), [more, setMore] = useState(false);
  const [workspaceBackups, setWorkspaceBackups] = useState<{ id: string; payload: unknown; created_at: string }[]>([]);
  const [remoteBackups, setRemoteBackups] = useState<RecoverySnapshot[]>([]), [share, setShare] = useState<string | null>(null);
  const [cloudHistory, setCloudHistory] = useState<ReturnType<typeof playerHistory> | null>(null);
  const [authForm] = Form.useForm(), [passwordForm] = Form.useForm();
  const [toast, toastHolder] = message.useMessage();
  const { confirm, holder } = useConfirmation();
  useEffect(() => { void initialize().then(() => { startCloudSync(); }); }, []);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true); setFailure(null);
    try {
      if (tab !== "account" && openedSession && getSnapshot().data.hub?.activeId !== openedSession) throw new Error("The active session changed. Close and reopen Session tools before continuing.");
      await action();
      const current = activeRecord(getSnapshot().data);
      if (current) { setOpenedSession(current.id); setSessionTitle(current.metadata.title); }
      return true;
    } catch (e) { setFailure(e instanceof Error ? e.message : "Action failed"); return false; } finally { setBusy(false); }
  };
  const confirmed = (title: string, content: string, action: () => Promise<unknown>) => confirm(title, content, "Continue", async () => {
    try {
      if (openedSession && getSnapshot().data.hub?.activeId !== openedSession) throw new Error("The active session changed. Close and reopen Session tools before continuing.");
      await action();
      const current = activeRecord(getSnapshot().data);
      if (current) { setOpenedSession(current.id); setSessionTitle(current.metadata.title); }
      return { ok: true };
    } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Action failed" }; }
  });
  const loadSessions = async (page = 0) => {
    const result = await cloudRequest<{ sessions: CloudSummary[] }>(`sessions?offset=${page}`);
    setSessions((previous) => page ? [...previous, ...result.sessions] : result.sessions); setOffset(page); setMore(result.sessions.length === 50);
  };
  const show = async () => {
    setOpen(true); setFailure(null); setSessionTitle(record?.metadata.title ?? "");
    if (!snapshot.loaded) return;
    await localChange((data) => { ensureHub(data, Date.now()); });
    const current = activeRecord(getSnapshot().data);
    setOpenedSession(current?.id ?? null); setSessionTitle(current?.metadata.title ?? "");
    void refreshCloudAuth();
  };
  const records = Object.values(hub?.records ?? {}).filter((r) => r.ownerId === null || r.ownerId === cloud.user?.id);
  const backups = [...(hub?.snapshots ?? [])].filter((s) => !s.ownerId || s.ownerId === cloud.user?.id).reverse();
  const history = cloudHistory ?? playerHistory(records.filter((r) => r.ownerId === (record?.ownerId ?? null)));
  const undo = record?.metadata.undo.at(-1);
  const pending = !!record && (record.flight || record.revision > record.acked || hub?.snapshots.some((s) => s.sessionId === record.id && !s.uploaded));
  const cloudLabel = record?.deleted ? "Cloud archive deleted · draft kept" : record?.conflict ? "Cloud conflict · both copies kept" : cloud.user?.id !== record?.ownerId ? "Sign in to sync" : pending ? "Cloud pending" : cloud.status;
  const credentials = <Form form={authForm} layout="vertical" onFinish={(values) => void run(async () => {
    const result = await cloudRequest<{ user: CloudUser }>(`auth/${authMode}`, "POST", { email: values.email, password: authMode === "signup" ? password : values.password });
    await setCloudUser(result.user); setPassword(null); setAcknowledged(false); authForm.resetFields(); toast.success("Cloud account connected. Your device session has not been uploaded.");
  })}>
    <Form.Item name="email" label="Email address" rules={[{ required: true, type: "email" }]}><Input autoComplete="email" /></Form.Item>
    {authMode === "login" ? <Form.Item name="password" label="Password" rules={[{ required: true }]}><Input.Password autoComplete="current-password" /></Form.Item> : <>
      <p>No verification email will be sent. Save this initial password before creating your account.</p>
      {password ? <><Input.Password aria-label="Generated initial password" value={password} readOnly autoComplete="off" /><Space wrap style={{ margin: "12px 0" }}><Button onClick={() => void navigator.clipboard.writeText(password).then(() => toast.success("Password copied"))}>Copy password</Button><Button onClick={() => download("badmintoner-cloud-login.txt", `Badmintoner cloud login\nEmail: ${authForm.getFieldValue("email") ?? ""}\nPassword: ${password}\nKeep this file private. Change the password in Cloud Account settings.\n`)}>Download login details</Button></Space><Checkbox checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)}>I have saved my initial password</Checkbox></> : <Button onClick={() => { setPassword(generateInitialPassword()); setAcknowledged(false); }}>Generate initial password</Button>}
    </>}
    <div style={{ marginTop: 16 }}><Button type="primary" htmlType="submit" loading={busy} disabled={authMode === "signup" && (!cloud.signupReady || !password || !acknowledged)}>{authMode === "signup" ? "Create cloud account" : "Sign in"}</Button></div>
    <Button type="link" onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setPassword(null); setAcknowledged(false); authForm.resetFields(); }}>{authMode === "login" ? "Create an account" : "I already have an account"}</Button>
    <p style={{ color: "var(--ant-color-text-secondary)" }}>Lost passwords are reset by the project administrator. No email reset links are sent.</p>
  </Form>;
  const account = !cloud.user ? <>{!cloud.configured && <Alert type="info" title="Cloud is unavailable. All device tools and offline queuing remain available." />}{cloud.configured && !cloud.signupReady && <Alert type="warning" title="New accounts are disabled until Supabase no-email signup is configured. Existing accounts can still sign in." />}{credentials}</> : <>
    <p>Signed in as <strong>{cloud.user.email}</strong></p>
    <p>{cloud.status}</p>
    <Form form={passwordForm} layout="vertical" onFinish={(values) => void run(async () => { await cloudRequest("auth/password", "POST", values); passwordForm.resetFields(); toast.success("Password changed"); })}>
      <Form.Item name="currentPassword" label="Current password" rules={[{ required: true }]}><Input.Password autoComplete="current-password" /></Form.Item>
      <Form.Item name="password" label="New password" rules={[{ required: true, min: 12 }]}><Input.Password autoComplete="new-password" /></Form.Item>
      <Button htmlType="submit" loading={busy}>Change password</Button>
    </Form>
    <Button style={{ marginTop: 24 }} onClick={() => void run(async () => { await cloudRequest("auth/logout", "POST", {}); await setCloudUser(null, true); setSessions([]); setCloudHistory(null); setShare(null); setRemoteBackups([]); setWorkspaceBackups([]); })}>Sign out of cloud</Button>
  </>;
  const sessionTools = <>
    <Space wrap><Button onClick={() => window.open("/queuing?display=tv", "_blank", "noopener")}>Open TV display</Button><Button disabled={!undo || busy} onClick={() => void run(() => undoLast(undo!.id))}>Undo recent action</Button></Space>
    {undo && <p>Available undo: {undo.label}</p>}
    <Form layout="vertical" style={{ marginTop: 16 }} onFinish={() => void run(() => renameSession(sessionTitle))}><Form.Item label="Current session title"><Input aria-label="Current session title" value={sessionTitle} maxLength={200} onChange={(e) => setSessionTitle(e.target.value)} /></Form.Item><Button htmlType="submit">Save title</Button></Form>
    {cloud.user ? <div style={{ marginTop: 16 }}><Checkbox checked={linkNames} onChange={(e) => setLinkNames(e.target.checked)}>Explicitly link matching player names to existing cloud identities</Checkbox><p>Leave unchecked to stop on name conflicts. Rename device database entries first to keep different people separate.</p><Space wrap><Button type="primary" loading={busy} onClick={() => void run(() => connectCurrent(sessionTitle, linkNames))}>{record?.ownerId ? "Save session to cloud" : "Save this local session to cloud"}</Button><Button onClick={() => void run(() => loadSessions())}>Refresh cloud sessions</Button><Button disabled={!record?.ownerId || !record.version} onClick={() => void run(async () => { const result = await cloudRequest<{ token: string | null }>(`sessions/${record!.id}/share`); setShare(result.token ? `${location.origin}/queuing/view/${result.token}` : ""); })}>Share queue</Button></Space></div> : <p>Sign in on the Account tab to save sessions online or create a QR link.</p>}
    {record?.conflict && <Alert style={{ marginTop: 16 }} type="warning" title="Cloud conflict · both copies preserved" description={<Space wrap>{([['cloud','Use cloud'],['device','Use this device'],['copy','Save device copy separately']] as const).map(([choice,label]) => <Button key={choice} onClick={() => void confirmed(label + "?", "A recovery snapshot will preserve the device copy. Financial entries and logs will never be automatically merged.", () => resolveSessionConflict(record.id, choice))}>{label}</Button>)}</Space>} />}
    {cloud.user && hub?.workspaces[cloud.user.id]?.conflict && <Alert type="warning" title="Player database/templates conflict" description={<Space><Button onClick={() => void run(() => resolveWorkspace("cloud"))}>Use cloud workspace</Button><Button onClick={() => void run(() => resolveWorkspace("device"))}>Use device workspace</Button></Space>} />}
    <h3>On this device</h3>
    {records.map((r) => <div key={r.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--ant-color-border-secondary)" }}><strong>{r.metadata.title}</strong> <Tag>{r.session.sessionStatus}</Tag><Tag>{r.ownerId ? "Cloud-linked" : "Device"}</Tag>{r.metadata.kind === "recovery" && <Tag color="orange">Recovery · excluded from statistics</Tag>}<Space wrap><Button disabled={r.id === hub?.activeId} onClick={() => void confirmed("Open this session?", "The outgoing session will be kept on this device with a recovery snapshot.", () => openDeviceSession(r.id))}>Open</Button><Button onClick={() => download(`Session-${r.id}.json`, JSON.stringify(r.session, null, 2))}>Export</Button>{r.metadata.kind === "recovery" && <Button onClick={() => void confirmed("Include this session in history?", "Only adopt this copy if it represents a distinct played session. Including duplicate copies will double-count games.", () => adoptRecovery(r.id))}>Include in history</Button>}</Space></div>)}
    {!!sessions.length && <><h3>Cloud sessions</h3>{sessions.map((r) => <div key={r.id} style={{ padding: "10px 0" }}><strong>{r.metadata.title}</strong> <Tag>{r.status}</Tag><Space wrap><Button onClick={() => void confirmed("Open the cloud copy?", "Your outgoing device draft will be preserved. Running matches must finish or stop first.", () => openCloudSession(r.id))}>Open cloud copy</Button><Button onClick={() => void run(async () => { setRemoteBackups(await readCloudSnapshots(r.id)); setTab("backups"); })}>Cloud backups</Button><Button danger onClick={() => void confirmed("Delete this cloud archive?", "This removes the cloud session and its display link. Recovery snapshots remain available.", async () => { await cloudRequest(`sessions/${r.id}`, "DELETE", {}); await localChange((data) => { const cached = data.hub?.records[r.id]; if (cached) cached.deleted = true; }); await loadSessions(); })}>Delete cloud archive</Button></Space></div>)}{more && <Button onClick={() => void run(() => loadSessions(offset + 50))}>Load more sessions</Button>}</>}
  </>;
  const workspaceCopies = Object.keys(hub?.workspaces ?? {}).filter((key) => cloud.user && key.startsWith(`recovery-workspace:${cloud.user.id}:`));
  const allBackups = [...remoteBackups, ...backups.filter((s) => !remoteBackups.some((r) => r.id === s.id))];
  return <>
    {toastHolder}{holder}
    <Space orientation="vertical" size={0}><Button disabled={!snapshot.loaded} onClick={() => void show().catch((e) => setFailure(e.message))}>Session tools</Button>{record?.ownerId && <small role="status" aria-label="Cloud sync status">{cloudLabel}</small>}</Space>
    <Drawer title="Session tools" open={open} onClose={() => { if (!busy) { setOpen(false); setPassword(null); setAcknowledged(false); authForm.resetFields(); passwordForm.resetFields(); } }} size="large" styles={{ wrapper: { maxWidth: "100vw" } }}>
      <Alert type="info" title={record?.ownerId ? cloud.status : "Saved on this device · cloud is optional"} description="Offline queuing works without an account. Cloud copies belong to the signed-in organizer." />
      {(failure || cloud.error) && <Alert style={{ marginTop: 12 }} type="error" title={failure ?? cloud.error} closable onClose={() => setFailure(null)} />}
      <Tabs more={{ trigger: "click", icon: <span aria-label="More session tabs">•••</span> }} activeKey={tab} onChange={setTab} items={[
        { key: "sessions", label: "Sessions", children: sessionTools },
        { key: "account", label: "Account", children: account },
        { key: "backups", label: "Backups", children: <><p>Recovery snapshots preserve the exact session state. Restoring creates a separate recovery copy and does not change the original archive.</p>{!allBackups.length && <p>No recovery snapshots yet.</p>}{cloud.user && <Button onClick={() => void run(async () => { const result = await cloudRequest<{ snapshots: { id: string; payload: unknown; created_at: string }[] }>("workspace/snapshots"); setWorkspaceBackups(result.snapshots); })}>Load cloud database/template backups</Button>}{workspaceBackups.map((copy) => <div key={copy.id}><p>Cloud workspace · {new Date(copy.created_at).toLocaleString()}</p><Button onClick={() => void confirmed("Restore this workspace backup?", "The current database and templates will be preserved before replacement.", () => restoreCloudWorkspacePayload(copy.payload))}>Restore cloud workspace</Button></div>)}{workspaceCopies.map((key, i) => <div key={key}><p>Player database and templates recovery copy {i + 1}</p><Button onClick={() => void confirmed("Restore this workspace copy?", "The current player database and templates will be preserved as another recovery copy first.", () => restoreWorkspaceCopy(key))}>Restore workspace copy</Button></div>)}{allBackups.map((s) => <div key={s.id} style={{ padding: "12px 0" }}><strong>{s.metadata.title}</strong><p>{s.reason} · {new Date(s.at).toLocaleString()}</p><Button onClick={() => void confirmed("Restore this recovery copy?", "The current session will be backed up first. Restored copies are excluded from historical statistics until explicitly adopted.", () => restoreCopy(s))}>Restore copy</Button></div>)}</> },
        { key: "templates", label: "Templates", children: <><p>Templates keep selected players, courts and expense defaults. Results, charges, payments, attendance and logs start fresh.</p><Space.Compact style={{ width: "100%" }}><Input aria-label="Template name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} maxLength={100} placeholder="Wednesday evening" /><Button onClick={() => void run(async () => { await saveTemplate(templateName); setTemplateName(""); })}>Save template</Button></Space.Compact>{workspace?.payload.templates.map((t) => <div key={t.id} style={{ padding: "12px 0" }}><strong>{t.name}</strong><p>{t.playerIds.length} players · {t.courts.length} courts · Court fee {money(t.expenses.courtFee)}</p><Space><Button onClick={() => void confirmed("Start from this template?", "Your current session will be backed up first. Running matches must finish or stop before switching.", () => applySavedTemplate(t))}>Use template</Button><Button danger onClick={() => void confirmed("Delete this template?", "This removes only the template, not players or previous sessions.", () => deleteTemplate(t.id))}>Delete template</Button></Space></div>)}</> },
        { key: "players", label: "Player history", children: <><p>Players are linked by stable database identities. Imported players are never merged by name automatically.</p>{snapshot.data.session.players.map((p) => <div key={p.id} style={{ marginBottom: 12 }}><Typography.Text strong>{p.name}</Typography.Text><Select aria-label={`History identity for ${p.name}`} style={{ width: "100%" }} value={record?.metadata.links[p.id]} placeholder="Choose an existing identity" options={Object.entries(workspace?.payload.identities ?? {}).map(([id, value]) => ({ value: id, label: value.name + (workspace?.payload.library.some((p) => p.id === id) ? "" : " · historical identity") }))} onChange={(id) => void run(() => linkPlayer(p.id, id))} />{!record?.metadata.links[p.id] && <Button onClick={() => void run(() => savePlayerIdentity(p.id))}>Create player database identity</Button>}</div>)}{cloud.user && <Space wrap><Button onClick={() => void run(async () => { const result = await cloudRequest<{ players: ReturnType<typeof playerHistory> }>("history"); setCloudHistory(result.players); })}>Load cloud history</Button><Button onClick={() => setCloudHistory(null)}>Show device history</Button></Space>}<Table style={{ marginTop: 16 }} size="small" rowKey="id" dataSource={history} scroll={{ x: 600 }} pagination={{ pageSize: 10, showSizeChanger: false }} columns={[{ title: "Player", dataIndex: "name" }, { title: "Attendance", dataIndex: "sessions" }, { title: "Games", dataIndex: "games" }, { title: "Wins", dataIndex: "wins" }, { title: "Losses", dataIndex: "losses" }, { title: "Recorded idle", render: (_, r) => formatDuration(r.idle) }, { title: "Idle time per game", render: (_, r) => r.idlePerGame === null ? "—" : formatDuration(Math.round(r.idlePerGame)) }, { title: "Partners", render: (_, r) => Object.entries(r.partners).map(([id,n]) => `${workspace?.payload.identities[id]?.name ?? history.find((p) => p.id === id)?.name ?? "Unlinked player"}: ${n}`).join(", ") || "—" }]} /></> },
      ]} />
    </Drawer>
    <Modal title="Read-only queue link" open={share !== null} onCancel={() => setShare(null)} footer={null}>
      <p>Only courts and upcoming teams are shared. Payments, player logs and account information remain private.</p>
      {share && <><QRCode value={share} /><Input aria-label="Read-only display link" readOnly value={share} style={{ margin: "16px 0" }} /><Button onClick={() => void navigator.clipboard.writeText(share).then(() => toast.success("Link copied"))}>Copy link</Button></>}
      <Space wrap style={{ marginTop: 16 }}><Button onClick={() => void run(async () => { const result = await cloudRequest<{ token: string }>(`sessions/${record!.id}/share`, "POST", {}); setShare(`${location.origin}/queuing/view/${result.token}`); })}>{share ? "Regenerate link" : "Create QR link"}</Button>{share && <Button danger onClick={() => void run(async () => { await cloudRequest(`sessions/${record!.id}/share`, "DELETE", {}); setShare(""); })}>Revoke link</Button>}</Space>
    </Modal>
  </>;
}

import { PlayersDbEntry } from "../types";
import { ActionResult, errorText, initialSession, parseLibrary } from "./model";
import { Command } from "./transitions";
import { commitCommand, StoredData, transact } from "./storage";
import { measureQueue } from "./performance";
const empty = { revision: -1, session: initialSession(0), library: [] };
export interface Snapshot {
  data: StoredData;
  loaded: boolean;
  pending: number;
  error: string | null;
}
const server: Snapshot = {
  data: empty,
  loaded: false,
  pending: 0,
  error: null,
};
let snapshot = server;
let workspaceSnapshot = server;
const listeners = new Set<() => void>();
let channel: BroadcastChannel | undefined;
let initializing: Promise<void> | undefined;
const publish = (patch: Partial<Snapshot>) => {
  if ((Object.keys(patch) as (keyof Snapshot)[]).every((key) => Object.is(snapshot[key], patch[key]))) return;
  snapshot = { ...snapshot, ...patch };
  if (snapshot.data !== workspaceSnapshot.data || snapshot.loaded !== workspaceSnapshot.loaded || snapshot.error !== workspaceSnapshot.error)
    workspaceSnapshot = snapshot;
  measureQueue("publish", () => listeners.forEach((fn) => fn()));
};
export function shareUnchanged<T>(before: T, after: T): T {
  if (Object.is(before, after)) return before;
  if (before === null || after === null || typeof before !== "object" || typeof after !== "object" || Array.isArray(before) !== Array.isArray(after)) return after;
  const old = before as Record<string, unknown>;
  const next = after as Record<string, unknown>;
  const keys = Object.keys(next);
  let same = Object.keys(old).length === keys.length;
  const result = (Array.isArray(after) ? [] : { ...after }) as Record<string, unknown>;
  for (const key of keys) {
    result[key] = shareUnchanged(old[key], next[key]);
    if (!Object.hasOwn(old, key) || result[key] !== old[key]) same = false;
  }
  return same ? before : result as T;
}
const accept = (data: StoredData) => {
  if (data.revision > snapshot.data.revision) publish({ data: measureQueue("structural-sharing", () => shareUnchanged(snapshot.data, data)) });
};
export const getSnapshot = () => snapshot;
export const getWorkspaceSnapshot = () => workspaceSnapshot;
export const getServerSnapshot = () => server;
export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export async function refresh() {
  try {
    accept(await transact());
    publish({ loaded: true, error: null });
  } catch (e) {
    publish({ error: errorText(e) });
  }
}
export function initialize() {
  if (!initializing) {
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel("badminton-queue-commits");
      channel.onmessage = () => {
        void refresh();
      };
    }
    window.addEventListener("focus", () => {
      void refresh();
    });
    initializing = refresh();
  }
  return initializing;
}
async function save(
  operation: () => Promise<StoredData>,
  id?: string,
): Promise<ActionResult> {
  if (!snapshot.loaded)
    return {
      ok: false,
      error: "Storage is not ready. Retry loading before making changes.",
    };
  publish({ pending: snapshot.pending + 1, error: null });
  try {
    accept(await operation());
    channel?.postMessage({ revision: snapshot.data.revision });
    return { ok: true, id };
  } catch (e) {
    const error = errorText(e);
    publish({ error });
    return { ok: false, error };
  } finally {
    publish({ pending: snapshot.pending - 1 });
  }
}
export const dispatch = (action: Command): Promise<ActionResult> =>
  save(
    () => commitCommand(action, Date.now()),
    "id" in action ? action.id : undefined,
  );
export const editLibrary = (
  change: (entries: PlayersDbEntry[]) => PlayersDbEntry[],
) =>
  save(() =>
    transact((data) => ({
      ...data,
      library: parseLibrary(change(data.library)),
    })),
  );

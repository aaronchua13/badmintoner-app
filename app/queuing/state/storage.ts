import { PlayersDbEntry } from "../types";
import { initialSession, parseSession, parseLibrary, QueueData } from "./model";
import { Command, transitionValidated } from "./transitions";
import { measureQueue } from "./performance";
export interface StoredData {
  revision: number;
  session: QueueData;
  library: PlayersDbEntry[];
}
export const DATABASE_NAME = "badminton-queuing";
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("data");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Cannot open browser storage"));
    request.onblocked = () =>
      reject(
        new Error(
          "Storage upgrade blocked. Close older queuing tabs and reload.",
        ),
      );
  });
}
function legacyData(): StoredData {
  // Originals are deliberately retained as backups. Invalid data is never silently discarded.
  const raw =
    localStorage.getItem("badminton_queue_data_v2") ??
    localStorage.getItem("badminton_queue_data");
  const parsed = raw ? JSON.parse(raw) : null;
  const library = localStorage.getItem("badminton_players_db");
  return {
    revision: 0,
    session: parsed
      ? parseSession(parsed.data ?? parsed)
      : initialSession(Date.now()),
    library: library ? parseLibrary(JSON.parse(library)) : [],
  };
}
export async function transact(
  change?: (data: StoredData) => StoredData,
): Promise<StoredData> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("data", "readwrite");
    const store = tx.objectStore("data");
    let result: StoredData;
    let failure: unknown;
    const readStart = typeof window !== "undefined" && Object.hasOwn(window, "queuePerf") ? performance.now() : null;
    const request = store.get("current");

    request.onsuccess = () => {
      if (readStart !== null) performance.measure("queue:read", { start: readStart, end: performance.now() });
      try {
        const existing: StoredData | undefined = request.result;
        const raw = existing ?? legacyData();
        const current = { ...raw, session: measureQueue("validate-input", () => parseSession(raw.session)) };
        result = change
          ? { ...change(current), revision: current.revision + 1 }
          : current;
        if (change || !existing || existing.session.schemaVersion !== 4)
          measureQueue("write-request", () => store.put(result, "current"));
      } catch (error) {
        failure = error;
        tx.abort();
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(
        failure ??
          tx.error ??
          new Error(
            "Browser storage unavailable. Your changes were not saved.",
          ),
      );
    };
  });
}
export function commitCommand(action: Command, now: number) {
  return transact((data) => {
    if (
      (action.type === "importSession" ||
        action.type === "setPlayerCharges" ||
        action.type === "finalizeBilling" ||
        action.type === "reopenBilling") &&
      action.revision !== data.revision
    )
      throw new Error(
        "Session changed in another tab. Review it and try again.",
      );
    const session = measureQueue("transition", () => transitionValidated(data.session, action, now));
    let library = data.library;
    if (action.type === "addPlayer") {
      const p = session.players.find((p) => p.id === action.id)!;
      if (!library.some((e) => e.name.toLowerCase() === p.name.toLowerCase()))
        library = [
          ...library,
          {
            id: `pdb-${p.id}`,
            name: p.name,
            gender: p.gender,
            level: p.level,
            createdAt: now,
            updatedAt: now,
          },
        ];
    }
    return { ...data, session, library };
  });
}

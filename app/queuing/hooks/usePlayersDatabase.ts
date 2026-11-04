import { useEffect, useState, useSyncExternalStore } from "react";
import { Gender, PlayerLevel } from "../types";
import {
  editLibrary,
  getSnapshot,
  getServerSnapshot,
  initialize,
  refresh,
  subscribe,
} from "../state/store";
export const usePlayersDatabase = () => {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const [searchQuery, setSearchQuery] = useState("");
  useEffect(() => {
    void initialize();
  }, []);
  const entries = snapshot.data.library;
  const add = (name: string, gender: Gender, level: PlayerLevel) => {
    const now = Date.now();
    const id = crypto.randomUUID();
    return editLibrary((db) => [
      ...db,
      { id, name: name.trim(), gender, level, createdAt: now, updatedAt: now },
    ]);
  };
  return {
    entries,
    filtered: entries.filter((e) =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase()),
    ),
    searchQuery,
    setSearchQuery,
    refresh,
    add,
    error: snapshot.error,
    remove: (id: string) => editLibrary((db) => db.filter((e) => e.id !== id)),
    updateName: (id: string, name: string) =>
      editLibrary((db) =>
        db.map((e) =>
          e.id === id ? { ...e, name: name.trim(), updatedAt: Date.now() } : e,
        ),
      ),
    updateGender: (id: string, gender: Gender) =>
      editLibrary((db) =>
        db.map((e) =>
          e.id === id ? { ...e, gender, updatedAt: Date.now() } : e,
        ),
      ),
    updateLevel: (id: string, level: PlayerLevel) =>
      editLibrary((db) =>
        db.map((e) =>
          e.id === id ? { ...e, level, updatedAt: Date.now() } : e,
        ),
      ),
  };
};

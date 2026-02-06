import { useCallback, useState } from 'react';
import { PlayersDbEntry, PlayerLevel, Gender } from '../types';
import { v4 as uuidv4 } from 'uuid';

const DB_KEY = 'badminton_players_db';

const readDb = (): PlayersDbEntry[] => {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
};

const writeDb = (entries: PlayersDbEntry[]) => {
  localStorage.setItem(DB_KEY, JSON.stringify(entries));
};

export const usePlayersDatabase = () => {
  const [entries, setEntries] = useState<PlayersDbEntry[]>(() => readDb());
  const [searchQuery, setSearchQuery] = useState('');

  const refresh = useCallback(() => {
    setEntries(readDb());
  }, []);

  const add = useCallback((name: string, gender: Gender, level: PlayerLevel) => {
    const now = Date.now();
    const exists = readDb().some(e => e.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (exists) {
      return { ok: false as const, error: 'Player name already exists in database' };
    }
    const newEntry: PlayersDbEntry = {
      id: `pdb-${uuidv4()}`,
      name: name.trim(),
      gender,
      level,
      createdAt: now,
      updatedAt: now
    };
    const next = [...readDb(), newEntry];
    writeDb(next);
    setEntries(next);
    return { ok: true as const, entry: newEntry };
  }, []);

  const remove = useCallback((id: string) => {
    const next = readDb().filter(e => e.id !== id);
    writeDb(next);
    setEntries(next);
    return { ok: true as const };
  }, []);

  const updateName = useCallback((id: string, name: string) => {
    const lower = name.trim().toLowerCase();
    const db = readDb();
    const conflict = db.some(e => e.id !== id && e.name.trim().toLowerCase() === lower);
    if (conflict) return { ok: false as const, error: 'Duplicate name in database' };
    const next = db.map(e => e.id === id ? { ...e, name: name.trim(), updatedAt: Date.now() } : e);
    writeDb(next);
    setEntries(next);
    return { ok: true as const };
  }, []);

  const updateGender = useCallback((id: string, gender: Gender) => {
    const next = readDb().map(e => e.id === id ? { ...e, gender, updatedAt: Date.now() } : e);
    writeDb(next);
    setEntries(next);
    return { ok: true as const };
  }, []);

  const updateLevel = useCallback((id: string, level: PlayerLevel) => {
    const next = readDb().map(e => e.id === id ? { ...e, level, updatedAt: Date.now() } : e);
    writeDb(next);
    setEntries(next);
    return { ok: true as const };
  }, []);

  const addIfNotExists = useCallback((name: string, gender: Gender, level: PlayerLevel) => {
    const db = readDb();
    const exists = db.some(e => e.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (exists) return { ok: true as const, existed: true as const };
    return add(name, gender, level);
  }, [add]);

  const filtered = entries.filter(e => {
    if (!searchQuery) return true;
    return e.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return {
    entries,
    filtered,
    searchQuery,
    setSearchQuery,
    refresh,
    add,
    addIfNotExists,
    remove,
    updateName,
    updateGender,
    updateLevel
  };
};

import { Expenses, Arrangement, Receipt } from "../state/billing";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { Gender, PlayerLevel } from "../types";
import { ActionResult, errorText, parseSession } from "../state/model";
import { PlayerInput, Scores, TeamChange, TransferSource } from "../state/transitions";
import {
  dispatch,
  getWorkspaceSnapshot,
  getServerSnapshot,
  initialize,
  refresh,
  subscribe,
} from "../state/store";
export const useQueuingState = () => {
  const snapshot = useSyncExternalStore(
    subscribe,
    getWorkspaceSnapshot,
    getServerSnapshot,
  );
  useEffect(() => {
    void initialize();
  }, []);
  const data = snapshot.data.session;
  const state = useMemo(() => ({
    ...data,
    isLoaded: snapshot.loaded,
    storageError: snapshot.error,
  }), [data, snapshot.loaded, snapshot.error]);
  const actions = useMemo(() => ({
    retryStorage: refresh,
    setCalculatorExclusions: (playerIds: string[]) =>
      dispatch({ type: "setCalculatorExclusions", playerIds }),
    setPlayerCharges: (
      playerIds: string[],
      exemptPlayerIds: string[],
      amount: number,
    ) =>
      dispatch({
        type: "setPlayerCharges",
        playerIds,
        exemptPlayerIds,
        amount,
        revision: snapshot.data.revision,
      }),
    setExpenses: (values: Expenses, calculatorExcluded?: string[]) =>
      dispatch({ type: "setExpenses", values, calculatorExcluded }),
    setArrangement: (playerId: string, values: Arrangement) =>
      dispatch({ type: "setArrangement", playerId, values }),
    saveReceipt: (values: Receipt, original?: Receipt) =>
      original
        ? dispatch({ type: "saveReceipt", values, editing: true, original })
        : dispatch({ type: "saveReceipt", values, editing: false }),
    deleteReceipt: (original: Receipt) => dispatch({ type: "deleteReceipt", id: original.id, original }),
    finalizeBilling: () =>
      dispatch({ type: "finalizeBilling", revision: snapshot.data.revision }),
    reopenBilling: () =>
      dispatch({ type: "reopenBilling", revision: snapshot.data.revision }),
    addPlayer: (values: PlayerInput) =>
      dispatch({ type: "addPlayer", values, id: crypto.randomUUID() }),
    checkInPlayer: (id: string) => dispatch({ type: "checkInPlayer", id }),
    undoCheckIn: (id: string) => dispatch({ type: "undoCheckIn", id }),
    addCourt: (name: string) =>
      dispatch({ type: "addCourt", name, id: crypto.randomUUID() }),
    removeCourt: (id: string) => dispatch({ type: "removeCourt", id }),
    clearCourt: (id: string) => dispatch({ type: "clearCourt", id }),
    updateCourtName: (id: string, name: string) =>
      dispatch({ type: "updateCourtName", id, name }),
    removePlayer: (id: string) => dispatch({ type: "removePlayer", id }),
    togglePlayerActive: (id: string) =>
      dispatch({ type: "togglePlayerActive", id }),
    renamePlayer: (id: string, name: string) => dispatch({ type: "renamePlayer", id, name }),
    updatePlayerLevel: (id: string, level: PlayerLevel) =>
      dispatch({ type: "updatePlayerLevel", id, level }),
    updatePlayerGender: (id: string, gender: Gender) =>
      dispatch({ type: "updatePlayerGender", id, gender }),
    togglePlayerSelection: (courtId: string, playerId: string) =>
      dispatch({
        type: "togglePlayerSelection",
        courtId,
        playerId,
        selected: !data.courts
          .find((c) => c.id === courtId)
          ?.players.includes(playerId),
      }),
    changeCourtTeams: (courtId: string, change: TeamChange, status: "idle" | "active", startTime: number | null) =>
      dispatch({ type: "changeCourtTeams", courtId, ...change, status, startTime }),
    changeQueueTeams: (queueId: string, change: TeamChange) =>
      dispatch({ type: "changeQueueTeams", queueId, ...change }),
    startMatch: (courtId: string) =>
      dispatch({
        type: "startMatch",
        courtId,
        players: data.courts.find((c) => c.id === courtId)?.players,
      }),
    finishMatch: (
      courtId: string,
      values: Scores,
      expectedStartTime = data.courts.find((c) => c.id === courtId)?.startTime ?? null,
      players = data.courts.find((c) => c.id === courtId)?.players ?? [],
    ) =>
      dispatch({
        type: "finishMatch",
        players,
        courtId,
        startTime: expectedStartTime,
        values,
        id: crypto.randomUUID(),
      }),
    stopMatch: (
      courtId: string,
      reason: string,
      expectedStartTime = data.courts.find((c) => c.id === courtId)?.startTime ?? null,
    ) =>
      dispatch({
        type: "stopMatch",
        courtId,
        startTime: expectedStartTime,
        reason,
        id: crypto.randomUUID(),
      }),
    stopMatchAndQueue: (courtId: string, expectedStartTime: number | null) =>
      dispatch({ type: "stopMatch", courtId, startTime: expectedStartTime, reason: "Stopped and moved to queue", id: crypto.randomUUID(), queueId: crypto.randomUUID() }),
    transferMatch: (
      from: string,
      to: string,
      original: TransferSource,
    ) =>
      dispatch({
        type: "transferMatch",
        from,
        to,
        original,
      }),
    startSession: () => dispatch({ type: "startSession" }),
    stopSession: () => dispatch({ type: "stopSession" }),
    resetState: () => dispatch({ type: "resetState" }),
    restartSession: () => dispatch({ type: "restartSession" }),
    createQueueItem: () =>
      dispatch({ type: "createQueueItem", id: crypto.randomUUID() }),
    addPlayerToQueueItem: (queueId: string, playerId: string) =>
      dispatch({ type: "addPlayerToQueueItem", queueId, playerId }),
    removePlayerFromQueue: (queueId: string, playerId: string) =>
      dispatch({ type: "removePlayerFromQueue", queueId, playerId }),
    removeQueueItem: (id: string) =>
      dispatch({ type: "removeQueueItem", id }),
    removePlayersFromQueue: (id: string) =>
      dispatch({ type: "removePlayersFromQueue", id }),
    moveQueueItem: (from: number, to: number) => {
      const items = [...data.queue];
      const [item] = items.splice(from, 1);
      if (!item || to < 0 || to > items.length)
        return Promise.resolve<ActionResult>({
          ok: false,
          error: "Invalid queue position",
        });
      return dispatch({
        type: "moveQueueItem",
        id: item.id,
        beforeId: items[to]?.id ?? null,
      });
    },
    moveCourtToQueue: (courtId: string, players: (string | null)[]) =>
      dispatch({ type: "moveCourtToQueue", courtId, queueId: crypto.randomUUID(), players }),
    assignQueueToCourt: (queueId: string, courtId: string, start = false) =>
      dispatch({ type: "assignQueueToCourt", queueId, courtId, start }),
    populateDummyPlayers: async (levels: PlayerLevel[]) => {
      for (const [i, name] of [
        "Allan",
        "Sam",
        "Bing",
        "Weng",
        "Joy",
        "Nora",
        "Dodie",
        "Krislyn",
        "Harvey",
        "Cloyd",
        "Aaron",
        "Jessica",
        "Nats",
        "Dan",
        "Flor",
        "Kayth",
        "Zoro",
        "Shanks",
        "Goku",
        "Christian P",
        "Charles",
        "Shaun",
        "Jerome",
        "Norman",
        "Psyche",
        "Phinky",
        "Kalai",
        "Hayabusa",
        "Luffy",
        "Naruto",
      ].entries()) {
        const result = await dispatch({
          type: "addPlayer",
          values: {
            name,
            level: levels[i % levels.length] ?? "Intermediate",
            gender: i % 2 ? "Female" : "Male",
          },
          id: crypto.randomUUID(),
        });
        if (!result.ok) return result;
      }
      return { ok: true } as ActionResult;
    },
    exportSession: () => {
      const blob = new Blob(
        [JSON.stringify({ ...data, schemaVersion: 4 }, null, 2)],
        { type: "application/json" },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Session-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    importSession: async (json: string): Promise<ActionResult> => {
      try {
        return await dispatch({
          type: "importSession",
          data: parseSession(JSON.parse(json)),
          revision: snapshot.data.revision,
        });
      } catch (e) {
        return { ok: false, error: errorText(e) };
      }
    },
  }), [data, snapshot.data.revision]);
  return { state, actions };
};

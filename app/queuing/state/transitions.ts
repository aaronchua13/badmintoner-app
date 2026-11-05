import { measureQueue } from "./performance";
import {
  Expenses,
  Arrangement,
  Receipt,
  expensesSchema,
  arrangementSchema,
  receiptSchema,
  calculateBilling,
} from "./billing";
import { Gender, PlayerLevel, Player, QueueItem, isCheckedIn } from "../types";
import { canQueuePlayer, isWaitingPlayer } from "../utils";
import { initialSession, playerInput, QueueData, parseSession } from "./model";
import { appendPlayerLogs } from "./activity";
export type PlayerInput = { name: string; level: PlayerLevel; gender: Gender };
export type Scores = {
  team1Score?: number;
  team2Score?: number;
  winningTeam?: number;
};
export type TeamSlots = [string | null, string | null, string | null, string | null];
export type TransferSource = { players: (string | null)[]; status: "idle" | "active"; startTime: number | null };
export type TeamChange = { original: (string | null)[]; players: TeamSlots };
export type Command =
  | ({ type: "changeCourtTeams"; courtId: string; status: "idle" | "active"; startTime: number | null } & TeamChange)
  | ({ type: "changeQueueTeams"; queueId: string } & TeamChange)
  | { type: "setExpenses"; values: Expenses; calculatorExcluded?: string[] }
  | { type: "setCalculatorExclusions"; playerIds: string[] }
  | {
      type: "setPlayerCharges";
      playerIds: string[];
      exemptPlayerIds: string[];
      amount: number;
      revision: number;
    }
  | { type: "setArrangement"; playerId: string; values: Arrangement }
  | { type: "saveReceipt"; values: Receipt; editing: false }
  | { type: "saveReceipt"; values: Receipt; editing: true; original: Receipt }
  | { type: "deleteReceipt"; id: string }
  | { type: "finalizeBilling" | "reopenBilling"; revision: number }
  | { type: "addPlayer"; values: PlayerInput; id: string }
  | { type: "checkInPlayer" | "undoCheckIn"; id: string }
  | { type: "addCourt"; name: string; id: string }
  | {
      type:
        | "removeCourt"
        | "clearCourt"
        | "removePlayer"
        | "togglePlayerActive"
        | "removeQueueItem"
        | "removePlayersFromQueue";
      id: string;
    }
  | { type: "renamePlayer"; id: string; name: string }
  | { type: "updateCourtName"; id: string; name: string }
  | { type: "updatePlayerLevel"; id: string; level: PlayerLevel }
  | { type: "updatePlayerGender"; id: string; gender: Gender }
  | {
      type: "togglePlayerSelection";
      courtId: string;
      playerId: string;
      selected: boolean;
    }
  | { type: "startMatch"; courtId: string; players?: (string | null)[] }
  | {
      type: "finishMatch";
      players: (string | null)[];
      courtId: string;
      startTime: number | null;
      values: Scores;
      id: string;
    }
  | {
      type: "stopMatch";
      queueId?: string;
      courtId: string;
      startTime: number | null;
      reason: string;
      id: string;
    }
  | {
      type: "transferMatch";
      from: string;
      to: string;
      original: TransferSource;
    }
  | { type: "startSession" | "stopSession" | "resetState" | "restartSession" }
  | { type: "createQueueItem"; id: string }
  | {
      type: "addPlayerToQueueItem" | "removePlayerFromQueue";
      queueId: string;
      playerId: string;
    }
  | { type: "moveQueueItem"; id: string; beforeId: string | null }
  | { type: "moveCourtToQueue"; courtId: string; queueId: string; players: (string | null)[] }
  | { type: "assignQueueToCourt"; queueId: string; courtId: string }
  | { type: "importSession"; data: QueueData; revision: number };
export const queueSlots = (q: QueueItem) => [
  q.team1[0] ?? null,
  q.team1[1] ?? null,
  q.team2[0] ?? null,
  q.team2[1] ?? null,
];
function requireCondition(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
export function transition(
  previous: QueueData,
  action: Command,
  now: number,
): QueueData {
  return transitionValidated(measureQueue("validate-input", () => parseSession(previous)), action, now);
}
// Internal entry point for storage, which has already validated the input.
export function transitionValidated(before: QueueData, action: Command, now: number): QueueData {
  const s = measureQueue("clone", () => structuredClone(before));
  s.autoAssignQueue = false;
  const court = (id: string) => {
    const c = s.courts.find((c) => c.id === id);
    requireCondition(c, "Court no longer exists");
    return c;
  };
  const player = (id: string) => {
    const p = s.players.find((p) => p.id === id);
    requireCondition(p, "Player no longer exists");
    return p;
  };
  const item = (id: string) => {
    const q = s.queue.find((q) => q.id === id);
    requireCondition(q, "Queue item no longer exists");
    return q;
  };
  const editable = () =>
    requireCondition(
      s.sessionStatus !== "ended",
      "Start a new session to make changes",
    );
  const removeAssignments = (id: string) => {
    s.courts.forEach((c) => {
      c.players = c.players.map((pid) => (pid === id ? null : pid));
    });
    s.queue.forEach((q) => {
      q.team1 = q.team1.filter((pid) => pid !== id);
      q.team2 = q.team2.filter((pid) => pid !== id);
    });
  };
  const assign = (q: QueueItem, courtId: string) => {
    const c = court(courtId);
    requireCondition(
      c.status === "idle" && c.players.every((id) => id === null),
      "Choose an empty idle court",
    );
    const ids = [...q.team1, ...q.team2];
    requireCondition(ids.length, "Add players to this match first");
    ids.forEach((id) => {
      const p = player(id);
      requireCondition(
        p.isActive &&
          isCheckedIn(p) &&
          !p.isPlaying &&
          !s.courts.some((c) => c.players.includes(id)),
        "A queued player is no longer available",
      );
    });
    c.players = queueSlots(q);
    s.queue = s.queue.filter((i) => i.id !== q.id);
  };
  switch (action.type) {
    case "setExpenses":
      s.billing.expenses = expensesSchema.parse(action.values);
      if (action.calculatorExcluded) {
        action.calculatorExcluded.forEach(player);
        s.billing.calculatorExcluded = [...action.calculatorExcluded];
      }
      break;
    case "setCalculatorExclusions":
      action.playerIds.forEach(player);
      s.billing.calculatorExcluded = [...action.playerIds];
      break;
    case "setPlayerCharges": {
      requireCondition(
        !s.billing.finalized,
        "Reopen settlement before changing charges",
      );
      requireCondition(
        action.playerIds.length > 0,
        "Select at least one player",
      );
      const ids = [...action.playerIds, ...action.exemptPlayerIds];
      requireCondition(
        new Set(ids).size === ids.length,
        "Choose distinct players",
      );
      ids.forEach(player);
      const arrangement = arrangementSchema.parse({
        kind: "shared",
        adjustment: "fixed",
        amount: action.amount,
      });
      for (const id of action.playerIds)
        s.billing.arrangements[id] = arrangement;
      for (const id of action.exemptPlayerIds) {
        requireCondition(
          !s.billing.arrangements[id],
          "Excluded player billing changed; review again",
        );
        s.billing.arrangements[id] = { kind: "none" };
      }
      break;
    }
    case "setArrangement":
      requireCondition(
        !s.billing.finalized,
        "Reopen settlement before changing charges",
      );
      player(action.playerId);
      s.billing.arrangements[action.playerId] = arrangementSchema.parse(
        action.values,
      );
      break;
    case "saveReceipt": {
      const receipt = receiptSchema.parse(action.values);
      player(receipt.playerId);
      const index = s.billing.receipts.findIndex((r) => r.id === receipt.id);
      requireCondition(
        action.editing ? index >= 0 : index < 0,
        "Payment changed or no longer exists. Close and reopen the editor to review the latest payment.",
      );
      if (action.editing) {
        const current = s.billing.receipts[index];
        requireCondition(
          current && Object.keys(receiptSchema.shape).every(
            (key) => current[key as keyof Receipt] === action.original[key as keyof Receipt],
          ),
          "Payment changed. Close and reopen the editor to review the latest payment.",
        );
      }
      if (index >= 0) {
        requireCondition(
          s.billing.receipts[index].playerId === receipt.playerId,
          "Cannot move a payment to another player",
        );
        s.billing.receipts[index] = receipt;
      } else s.billing.receipts.push(receipt);
      break;
    }
    case "deleteReceipt":
      requireCondition(
        s.billing.receipts.some((r) => r.id === action.id),
        "Payment no longer exists",
      );
      s.billing.receipts = s.billing.receipts.filter((r) => r.id !== action.id);
      break;
    case "finalizeBilling": {
      requireCondition(
        s.sessionStatus === "ended",
        "End the session before finalizing charges",
      );
      requireCondition(!s.billing.finalized, "Charges already finalized");
      const rows = calculateBilling(s).rows;
      requireCondition(
        rows.every((r) => r.arrangement),
        "Choose billing for every player first",
      );
      s.billing.finalized = {
        at: now,
        charges: rows.map((r) => ({
          playerId: r.id,
          arrangement: r.arrangement!,
          amount: r.charge!,
        })),
      };
      break;
    }
    case "reopenBilling":
      requireCondition(s.billing.finalized, "Settlement is not finalized");
      s.billing.finalized = null;
      break;
    case "addPlayer": {
      editable();
      const values = playerInput.parse(action.values);
      requireCondition(
        !s.players.some(
          (p) => p.name.toLowerCase() === values.name.toLowerCase(),
        ),
        "Player already in session",
      );
      const p: Player = {
        ...values,
        id: action.id,
        joinedAt: now,
        checkedInAt: null,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        totalIdleTime: 0,
        lastMatchEndTime: now,
        firstMatchTime: null,
        partners: {},
        isPlaying: false,
        isActive: true,
      };
      s.players.push(p);
      break;
    }
    case "checkInPlayer": {
      editable();
      const p = player(action.id);
      if (!isCheckedIn(p)) {
        p.checkedInAt = now;
        p.isActive = true;
        if (p.gamesPlayed === 0) p.lastMatchEndTime = now;
      }
      break;
    }
    case "undoCheckIn": {
      editable();
      const p = player(action.id);
      requireCondition(
        !p.isPlaying,
        "Finish or stop the player’s match before undoing check-in",
      );
      removeAssignments(p.id);
      p.checkedInAt = null;
      p.isActive = true;
      break;
    }
    case "addCourt":
      editable();
      requireCondition(action.name.trim(), "Enter a court name");
      s.courts.push({
        id: action.id,
        name: action.name.trim(),
        status: "idle",
        players: [null, null, null, null],
        startTime: null,
      });
      s.courtHistory.push({
        id: action.id,
        name: action.name.trim(),
        addedAt: now,
        removedAt: null,
        gamesPlayed: 0,
      });
      break;
    case "removeCourt":
      editable();
      requireCondition(
        court(action.id).status === "idle",
        "Finish or stop the match first",
      );
      s.courts = s.courts.filter((c) => c.id !== action.id);
      s.courtHistory.forEach((c) => {
        if (c.id === action.id) c.removedAt = now;
      });
      break;
    case "moveCourtToQueue": {
      editable();
      const c = court(action.courtId);
      requireCondition(c.status === "idle", "Cannot move a running match to queue");
      requireCondition(c.players.some(Boolean), "This court has no players");
      requireCondition(JSON.stringify(c.players) === JSON.stringify(action.players), "Court lineup changed; try again");
      requireCondition(!s.queue.some((q) => q.id === action.queueId), "Queue already exists");
      s.queue.push({
        id: action.queueId,
        team1: c.players.slice(0, 2).filter((id): id is string => id !== null),
        team2: c.players.slice(2, 4).filter((id): id is string => id !== null),
        createdAt: now,
      });
      c.players = [null, null, null, null];
      break;
    }
    case "clearCourt":
      editable();
      requireCondition(
        court(action.id).status === "idle",
        "Cannot clear a running match",
      );
      court(action.id).players = [null, null, null, null];
      break;
    case "updateCourtName":
      editable();
      requireCondition(action.name.trim(), "Enter a court name");
      court(action.id).name = action.name.trim();
      s.courtHistory.forEach((c) => {
        if (c.id === action.id) c.name = action.name.trim();
      });
      break;
    case "removePlayer":
      editable();
      requireCondition(
        !s.billing.receipts.some((r) => r.playerId === action.id) &&
          !s.billing.finalized,
        "Resolve payments and reopen settlement before removing this player",
      );
      s.billing.calculatorExcluded = s.billing.calculatorExcluded.filter(
        (id) => id !== action.id,
      );
      delete s.billing.arrangements[action.id];
      if (s.billing.estimate) delete s.billing.estimate[action.id];
      requireCondition(
        !player(action.id).isPlaying,
        "Finish the player’s match first",
      );
      removeAssignments(action.id);
      s.players = s.players.filter((p) => p.id !== action.id);
      break;
    case "togglePlayerActive":
      editable();
      requireCondition(
        isCheckedIn(player(action.id)),
        "Check in this player first",
      );
      requireCondition(
        !player(action.id).isPlaying,
        "Finish the player’s match first",
      );
      player(action.id).isActive = !player(action.id).isActive;
      if (!player(action.id).isActive) removeAssignments(action.id);
      break;
    case "renamePlayer": {
      editable();
      const values = playerInput.pick({ name: true }).parse({ name: action.name.trim() });
      player(action.id).name = values.name;
      break;
    }
    case "updatePlayerLevel":
      editable();
      player(action.id).level = action.level;
      break;
    case "updatePlayerGender":
      editable();
      player(action.id).gender = action.gender;
      break;
    case "togglePlayerSelection": {
      editable();
      const c = court(action.courtId);
      const p = player(action.playerId);
      requireCondition(
        c.status === "idle" && !p.isPlaying && p.isActive && isCheckedIn(p),
        "Player or court is no longer available",
      );
      if (!action.selected)
        c.players = c.players.map((id) => (id === p.id ? null : id));
      else if (!c.players.includes(p.id)) {
        requireCondition(
          !s.queue.some((q) => [...q.team1, ...q.team2].includes(p.id)),
          "Remove this player from the queue first",
        );
        requireCondition(c.players.includes(null), "Court is full");
        removeAssignments(p.id);
        c.players[c.players.indexOf(null)] = p.id;
      }
      break;
    }
    case "changeCourtTeams":
    case "changeQueueTeams": {
      editable();
      const c = action.type === "changeCourtTeams" ? s.courts.find((c) => c.id === action.courtId) : null;
      const q = action.type === "changeQueueTeams" ? s.queue.find((q) => q.id === action.queueId) : null;
      requireCondition(c || q, "Match no longer exists. Reopen the team editor and try again.");
      const current = c ? c.players : queueSlots(q!);
      requireCondition(
        action.original.length === 4 && current.every((id, i) => id === action.original[i]) &&
          (!c || (action.type === "changeCourtTeams" && c.status === action.status && c.startTime === action.startTime)),
        "Teams changed. Reopen the team editor and try again.",
      );
      const ids = action.players.filter((id): id is string => id !== null);
      const existing = current.filter((id): id is string => id !== null);
      requireCondition(
        action.players.length === 4 && new Set(ids).size === ids.length &&
          ids.length === existing.length,
        "Keep the same number of players with no duplicates",
      );
      const incoming = ids.filter((id) => !existing.includes(id));
      const outgoing = existing.filter((id) => !ids.includes(id));
      requireCondition(
        incoming.every((id) => {
          const p = s.players.find((p) => p.id === id);
          return p && (q ? canQueuePlayer(p, s.courts, s.queue) : isWaitingPlayer(p, s.courts, s.queue));
        }),
        "Replacement player is no longer available. Choose an eligible checked-in, active player",
      );
      if (c) {
        requireCondition(c.status !== "active" || ids.length === 4, "Running matches need four players");
        if (c.status === "active") {
          outgoing.forEach((id) => {
            const p = player(id);
            p.isPlaying = false;
            p.lastMatchEndTime = now;
          });
          incoming.forEach((id) => {
            const p = player(id);
            p.isPlaying = true;
            p.firstMatchTime ??= now;
            if (p.gamesPlayed > 0)
              p.totalIdleTime += Math.max(0, Math.floor((now - Math.max(
                p.lastMatchEndTime, p.checkedInAt ?? p.joinedAt, s.sessionStartTime ?? 0,
              )) / 1000));
          });
        }
        c.players = [...action.players];
      } else {
        q!.team1 = action.players.slice(0, 2).filter((id): id is string => id !== null);
        q!.team2 = action.players.slice(2).filter((id): id is string => id !== null);
      }
      break;
    }
    case "startMatch": {
      requireCondition(s.sessionStatus === "active", "Start the session first");
      const c = court(action.courtId);
      requireCondition(
        c.status === "idle" && c.players.every(Boolean),
        "Match needs four available players",
      );
      requireCondition(
        !action.players || action.players.every((id, i) => id === c.players[i]),
        "Court assignments changed. Review the players before starting.",
      );
      c.players.forEach((id) => {
        const p = player(id!);
        requireCondition(
          p.isActive && isCheckedIn(p) && !p.isPlaying,
          "Player is not available",
        );
        p.isPlaying = true;
        p.firstMatchTime ??= now;
        if (p.gamesPlayed > 0)
          p.totalIdleTime += Math.max(
            0,
            Math.floor(
              (now -
                Math.max(
                  p.lastMatchEndTime,
                  p.checkedInAt ?? p.joinedAt,
                  s.sessionStartTime ?? 0,
                )) /
                1000,
            ),
          );
      });
      c.status = "active";
      c.startTime = now;
      break;
    }
    case "finishMatch":
    case "stopMatch": {
      const c = court(action.courtId);
      requireCondition(
        c.status === "active" && c.startTime === action.startTime,
        "This match has changed or already ended",
      );
      if (action.type === "stopMatch" && action.queueId) {
        requireCondition(!s.queue.some((q) => q.id === action.queueId), "Queue already exists");
        requireCondition(!s.queue.some((q) => [...q.team1, ...q.team2].some((id) => c.players.includes(id))), "A player is already queued. Remove their existing booking first.");
        s.queue.push({
          id: action.queueId,
          team1: c.players.slice(0, 2).filter((id): id is string => id !== null),
          team2: c.players.slice(2, 4).filter((id): id is string => id !== null),
          createdAt: now,
        });
      }
      const finished = action.type === "finishMatch";
      if (finished) {
        requireCondition(
          action.players.length === 4 && c.players.every((id, i) => id === action.players[i]),
          "Teams changed. Reopen Finish Match and review the teams.",
        );
        requireCondition(
          action.values.winningTeam === 1 || action.values.winningTeam === 2,
          "Select a winner",
        );
        for (const score of [
          action.values.team1Score,
          action.values.team2Score,
        ])
          requireCondition(
            score === undefined || (Number.isInteger(score) && score >= 0),
            "Scores must be non-negative whole numbers",
          );
        requireCondition(
          (action.values.team1Score === undefined) ===
            (action.values.team2Score === undefined),
          "Enter both scores or leave both empty",
        );
        if (action.values.team1Score !== undefined && action.values.team2Score !== undefined) {
          requireCondition(action.values.team1Score !== action.values.team2Score, "Scores cannot be tied");
          requireCondition(
            action.values.winningTeam === (action.values.team1Score > action.values.team2Score ? 1 : 2),
            "Winner must match the higher-scoring team",
          );
        }
      }
      const participants = c.players.map((id, i) => ({
        id: id!,
        name: player(id!).name,
        team: (i < 2 ? 1 : 2) as 1 | 2,
      }));
      participants.forEach((entry) => {
        const p = player(entry.id);
        p.isPlaying = false;
        p.lastMatchEndTime = now;
        if (finished) {
          p.gamesPlayed++;
          if (entry.team === action.values.winningTeam) p.wins++;
          else p.losses++;
          participants
            .filter((tm) => tm.team === entry.team && tm.id !== p.id)
            .forEach((tm) => {
              p.partners[tm.id] = (p.partners[tm.id] ?? 0) + 1;
            });
        }
      });
      s.history.unshift({
        id: action.id,
        courtName: c.name,
        startTime: c.startTime!,
        endTime: now,
        duration: Math.max(0, Math.floor((now - c.startTime!) / 1000)),
        players: participants,
        ...(finished
          ? {
              winners: action.values.winningTeam as 1 | 2,
              score:
                action.values.team1Score !== undefined &&
                action.values.team2Score !== undefined
                  ? `${action.values.team1Score} - ${action.values.team2Score}`
                  : undefined,
            }
          : { isStopped: true, reason: action.reason }),
      });
      if (finished)
        s.courtHistory.forEach((h) => {
          if (h.id === c.id) h.gamesPlayed++;
        });
      c.status = "idle";
      c.startTime = null;
      c.players = [null, null, null, null];
      break;
    }
    case "transferMatch": {
      editable();
      const from = court(action.from);
      const to = court(action.to);
      requireCondition(
        from.id !== to.id &&
          from.startTime === action.original.startTime &&
          from.status === action.original.status &&
          action.original.players.length === 4 &&
          from.players.every((id, index) => id === action.original.players[index]) &&
          to.status === "idle" &&
          to.players.every((id) => id === null),
        "Courts changed. Reopen the transfer dialog and choose an empty court.",
      );
      to.players = [...from.players];
      to.status = from.status;
      to.startTime = from.startTime;
      from.players = [null, null, null, null];
      from.status = "idle";
      from.startTime = null;
      break;
    }
    case "startSession":
      requireCondition(s.sessionStatus === "idle", "Session already started");
      s.billing.estimate = Object.fromEntries(
        calculateBilling(s)
          .rows.filter((r) => r.charge !== null)
          .map((r) => [r.id, r.charge!]),
      );
      s.sessionStatus = "active";
      s.sessionStartTime = now;
      s.sessionEndTime = null;
      break;
    case "stopSession":
      requireCondition(s.sessionStatus === "active", "Session is not active");
      requireCondition(
        !s.courts.some((c) => c.status === "active"),
        `Finish or stop matches on ${s.courts
          .filter((c) => c.status === "active")
          .map((c) => c.name)
          .join(", ")} first`,
      );
      s.sessionStatus = "ended";
      s.sessionEndTime = now;
      break;
    case "resetState":
    case "restartSession": {
      requireCondition(
        !s.courts.some((c) => c.status === "active"),
        "Finish or stop all matches first",
      );
      const next = initialSession(now);
      next.courts = [];
      next.courtHistory = [];
      if (action.type === "restartSession") {
        next.courts = s.courts.map((c) => ({
          ...c,
          status: "idle",
          players: [null, null, null, null],
          startTime: null,
        }));
        next.courtHistory = next.courts.map((c) => ({
          id: c.id,
          name: c.name,
          addedAt: now,
          removedAt: null,
          gamesPlayed: 0,
        }));
        next.players = s.players.map((p) => ({
          ...p,
          isActive: true,
          isPlaying: false,
          checkedInAt: null,
          joinedAt: now,
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
          totalIdleTime: 0,
          lastMatchEndTime: now,
          firstMatchTime: null,
          partners: {},
        }));
      }
      return next;
    }
    case "createQueueItem":
      editable();
      s.queue.push({ id: action.id, team1: [], team2: [], createdAt: now });
      break;
    case "addPlayerToQueueItem": {
      editable();
      const q = item(action.queueId);
      const p = player(action.playerId);
      requireCondition(
        canQueuePlayer(p, s.courts, s.queue),
        "Player is already assigned or unavailable",
      );
      requireCondition(
        q.team1.length + q.team2.length < 4,
        "Queue item is full",
      );
      (q.team1.length < 2 ? q.team1 : q.team2).push(p.id);
      break;
    }
    case "removePlayerFromQueue": {
      editable();
      const q = item(action.queueId);
      q.team1 = q.team1.filter((id) => id !== action.playerId);
      q.team2 = q.team2.filter((id) => id !== action.playerId);
      break;
    }
    case "removeQueueItem":
      editable();
      s.queue = s.queue.filter((q) => q.id !== action.id);
      break;
    case "removePlayersFromQueue":
      editable();
      item(action.id).team1 = [];
      item(action.id).team2 = [];
      break;
    case "moveQueueItem": {
      editable();
      const q = item(action.id);
      s.queue = s.queue.filter((i) => i.id !== q.id);
      const index =
        action.beforeId === null
          ? s.queue.length
          : s.queue.findIndex((i) => i.id === action.beforeId);
      requireCondition(index >= 0, "Queue changed; try again");
      s.queue.splice(index, 0, q);
      break;
    }
    case "assignQueueToCourt":
      editable();
      assign(item(action.queueId), action.courtId);
      break;
    case "importSession":
      requireCondition(
        s.sessionStatus !== "active",
        "Cannot import during an active session",
      );
      return parseSession(action.data);
  }
  appendPlayerLogs(before, s, action, now);
  return measureQueue("validate-output", () => parseSession(s));
}

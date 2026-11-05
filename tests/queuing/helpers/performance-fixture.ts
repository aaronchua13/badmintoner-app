import { initialSession, parseSession } from "../../../app/queuing/state/model";
import { transition } from "../../../app/queuing/state/transitions";

export function performanceFixture(count: number, historyCount = 40, libraryCount = count) {
  const now = Date.now();
  let session = initialSession(now - 3_600_000);
  const run = (command: Parameters<typeof transition>[1]) => {
    session = transition(session, command, now - 1_200_000);
  };
  for (let i = 0; i < count; i++) {
    run({ type: "addPlayer", id: `p${i}`, values: {
      name: `Player ${String(i + 1).padStart(3, "0")}`,
      gender: i % 2 ? "Female" : "Male",
      level: i % 2 ? "Beginner" : "Intermediate",
    } });
    if (i < count - 2) run({ type: "checkInPlayer", id: `p${i}` });
  }
  run({ type: "startSession" });
  for (let i = 0; i < 4; i++)
    run({ type: "togglePlayerSelection", courtId: "c1", playerId: `p${i}`, selected: true });
  run({ type: "startMatch", courtId: "c1" });
  run({ type: "createQueueItem", id: "q1" });
  for (let i = 4; i < 8; i++)
    run({ type: "addPlayerToQueueItem", queueId: "q1", playerId: `p${i}` });
  session.history = Array.from({ length: historyCount }, (_, i) => ({
    id: `history-${i}`, courtName: "Court 1", startTime: now - 3_600_000,
    endTime: now - 2_400_000, duration: 1200, score: "21 - 15", winners: 1 as const,
    players: session.players.slice(0, 4).map((p, j) => ({ id: p.id, name: p.name, team: (j < 2 ? 1 : 2) as 1 | 2 })),
  }));
  session.billing.receipts = session.players.slice(0, 10).map((p, i) => ({
    id: `receipt-${i}`, playerId: p.id, amount: 10000, method: "cash" as const, paidAt: now, note: "",
  }));
  return {
    session: parseSession(session),
    library: Array.from({ length: libraryCount }, (_, i) => ({
      id: `db-${i}`, name: `Saved Player ${i + 1}`, gender: "Male" as const,
      level: "Intermediate" as const, createdAt: now, updatedAt: now,
    })),
  };
}

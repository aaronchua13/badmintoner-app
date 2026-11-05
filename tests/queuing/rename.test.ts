import { expect, it } from "vitest";
import { initialSession } from "../../app/queuing/state/model";
import { transition } from "../../app/queuing/state/transitions";

it("renames the player without changing their identity or statistics and rejects blank names", () => {
  const before = transition(initialSession(1000), { type: "addPlayer", id: "p1", values: { name: "Original", gender: "Male", level: "Intermediate" } }, 2000);
  const after = transition(before, { type: "renamePlayer", id: "p1", name: "  New name  " }, 3000);
  expect(after.players[0]).toEqual({ ...before.players[0], name: "New name" });
  expect(after.playerLogs.some((log) => log.message?.includes("Name changed"))).toBe(true);
  expect(() => transition(before, { type: "renamePlayer", id: "p1", name: "   " }, 3000)).toThrow();
});

import { afterEach, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { commitCommand, transact } from "../../../app/queuing/state/storage";
import { charged, receipt, NOW } from "./fixtures";
afterEach(() => vi.unstubAllGlobals());

// PAY-001 regression: deletion must compare the receipt reviewed by the organizer.
it("PAY-001: a stale delete must not erase another organizer's corrected payment", async () => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("localStorage", { getItem: () => null });
  await transact((d) => ({ ...d, session: charged() }));
  const original = receipt();
  await commitCommand({ type: "saveReceipt", editing: false, values: original }, NOW);
  // Organizer A reviews deletion of the original 100.00 cash receipt.
  // Organizer B corrects it to 220.00 digital before A confirms deletion.
  await commitCommand({ type: "saveReceipt", editing: true, original, values: { ...original, amount: 22000, method: "digital" } }, NOW + 1000);
  const corrected = await transact();
  // The original snapshot protects the corrected receipt from this stale confirmation.
  await expect(commitCommand({ type: "deleteReceipt", id: original.id, original }, NOW + 2000)).rejects.toThrow(/changed|review|another tab/i);
  expect(await transact()).toEqual(corrected);
});

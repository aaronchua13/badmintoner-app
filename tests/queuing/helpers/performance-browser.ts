import type { Page } from "@playwright/test";
import type { performanceFixture } from "./performance-fixture";

declare global {
  interface Window {
    queuePerf: { input: number[]; click: number[]; storage: number[]; commits: number; renderedFibers: number; mutations: number; renders: Record<string, number> };
  }
}

export async function instrumentPerformance(page: Page, fixture: ReturnType<typeof performanceFixture>) {
    await page.addInitScript(({ session, library }) => {
      if (!localStorage.getItem("badminton_queue_data_v2")) {
        localStorage.setItem("badminton_queue_data_v2", JSON.stringify({ version: 1, data: session }));
        localStorage.setItem("badminton_players_db", JSON.stringify(library));
      }
      window.queuePerf = { input: [], click: [], storage: [], commits: 0, renderedFibers: 0, mutations: 0, renders: {} };
      for (const type of ["input", "click"] as const) document.addEventListener(type, () => {
        const start = performance.now();
        requestAnimationFrame(() => requestAnimationFrame(() => window.queuePerf[type].push(performance.now() - start)));
      }, true);
      const transaction = IDBDatabase.prototype.transaction;
      IDBDatabase.prototype.transaction = function (...args: Parameters<typeof transaction>) {
        const start = performance.now();
        const tx = transaction.apply(this, args);
        tx.addEventListener("complete", () => window.queuePerf.storage.push(performance.now() - start));
        return tx;
      };
      // React's production DevTools hook exposes committed work without a dev build.
      Object.assign(window, { __REACT_DEVTOOLS_GLOBAL_HOOK__: {
        supportsFiber: true, inject: () => 1,
        previous: new WeakSet<object>(),
        onCommitFiberRoot(_id: number, root: { current: unknown }) {
          const next = new WeakSet<object>();
          window.queuePerf.commits++;
          const visit = (fiber: unknown) => {
            if (!fiber) return;
            const f = fiber as { flags: number; tag: number; child: unknown; sibling: unknown; type?: { displayName?: string } };
            next.add(f);
            if (!this.previous.has(f) && (f.tag === 0 || f.tag === 15) && (f.flags & 1)) {
              window.queuePerf.renderedFibers++;
              const name = f.type?.displayName;
              if (name) window.queuePerf.renders[name] = (window.queuePerf.renders[name] ?? 0) + 1;
            }
            visit(f.child); visit(f.sibling);
          };
          visit(root.current);
          this.previous = next;
        }, onCommitFiberUnmount: () => {},
      } });
      document.addEventListener("DOMContentLoaded", () => {
        new MutationObserver((records) => { window.queuePerf.mutations += records.length; })
          .observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
      });
    }, fixture);
}

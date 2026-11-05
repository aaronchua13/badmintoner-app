"use client";
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Alert,
  Button,
  ConfigProvider,
  Empty,
  Form,
  Modal,
  Segmented,
  Select,
  Spin,
  Steps,
  message,
  theme,
} from "antd";
import {
  PlusOutlined,
  TeamOutlined,
  AppstoreOutlined,
  OrderedListOutlined,
} from "@ant-design/icons";
import { Court, Gender, PlayerLevel, isCheckedIn } from "./types";
import { ActionResult } from "./state/model";
import { useConfirmation } from "./hooks/useConfirmation";
import { parseSession, errorText } from "./state/model";
import { useQueuingState } from "./hooks/useQueuingState";
import PaymentsPanel, { PaymentTag } from "./components/PaymentsPanel";
import { calculateBilling } from "./state/billing";
import QueuingHeader from "./components/QueuingHeader";
import LevelTag from "./components/LevelTag";
import CourtCard from "./components/CourtCard";
import PlayerPanel from "./components/PlayerPanel";
import QueueTab from "./components/QueueTab";
import AddPlayerModal from "./components/modals/AddPlayerModal";
import AddCourtModal from "./components/modals/AddCourtModal";
import ChangeTeamsModal from "./components/modals/ChangeTeamsModal";
import { isWaitingPlayer } from "./utils";
import { queueSlots, TeamSlots } from "./state/transitions";
import FinishMatchModal from "./components/modals/FinishMatchModal";
import StopMatchModal from "./components/modals/StopMatchModal";
import TransferCourtModal from "./components/modals/TransferCourtModal";
import HistoryModal from "./components/modals/HistoryModal";
import SessionSummaryModal from "./components/modals/SessionSummaryModal";
import InstructionsModal from "./components/modals/InstructionsModal";
import PlayerDetailsModal from "./components/modals/PlayerDetailsModal";
import PlayersDatabaseModal from "./components/modals/PlayersDatabaseModal";
import styles from "./QueuingClient.module.css";
import "./queuing-overlays.css";
import { useAppearance } from "./hooks/useAppearance";
type View = "courts" | "queue" | "players";
type Density = "compact" | "comfortable";
const densityKey = "badminton_queue_density";
function readDensity(): Density {
  try {
    return localStorage.getItem(densityKey) === "comfortable"
      ? "comfortable"
      : "compact";
  } catch {
    return "compact";
  }
}
function subscribeDensity(fn: () => void) {
  window.addEventListener("storage", fn);
  window.addEventListener("queue-density", fn);
  return () => {
    window.removeEventListener("storage", fn);
    window.removeEventListener("queue-density", fn);
  };
}
export default function QueuingClient() {
  const appearance = useAppearance();
  const primary = { emerald: "#047857", ocean: "#0369a1", violet: "#7c3aed" }[
    appearance.color
  ];
  const { state, actions } = useQueuingState();
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const [paymentPlayer, setPaymentPlayer] = useState<string | undefined>();
  const billingRows = useMemo(() => calculateBilling({ players: state.players, billing: state.billing }).rows, [state.players, state.billing]);
  const paymentTags = useMemo(() => Object.fromEntries(
    billingRows.filter((row) => row.arrangement || row.receipts.length).map((row) => [
      row.id, <PaymentTag key={row.id} row={row} finalized={!!state.billing.finalized} />,
    ]),
  ), [billingRows, state.billing.finalized]);
  const openPayments = (id?: string) => {
    setPaymentPlayer(id);
    setPaymentsOpen(true);
  };
  const {
    sessionStartTime,
    sessionEndTime,
    sessionStatus,
    courts,
    players,
    queue,
    history,
    courtHistory,
    isLoaded,
  } = state;
  const density = useSyncExternalStore(
    subscribeDensity,
    readDensity,
    () => "compact" as Density,
  );
  const [densityFallback, setDensityFallback] = useState<Density | null>(null);
  const activeDensity = densityFallback ?? density;
  const [view, setView] = useState<View>("players");
  const [queueMinimized, setQueueMinimized] = useState(true);
  const [queueHidden, setQueueHidden] = useState(false);
  const [tabletView, setTabletView] = useState<"queue" | "courts">("queue");
  const scroll = useRef<Record<View, number>>({
    courts: 0,
    queue: 0,
    players: 0,
  });
  const sectionRefs = useRef<Record<View, HTMLElement | null>>({
    courts: null,
    queue: null,
    players: null,
  });
  const workspaceRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const workspace = workspaceRef.current;
    const header = workspace?.querySelector("header");
    if (!workspace || !header) return;
    const measure = () =>
      workspace.style.setProperty(
        "--session-header-height",
        `${header.getBoundingClientRect().height}px`,
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const section = sectionRefs.current.queue;
    const heading = section?.firstElementChild;
    if (!section || !heading) return;
    const measure = () =>
      section.style.setProperty(
        "--queue-heading-height",
        `${heading.getBoundingClientRect().height}px`,
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(heading);
    return () => observer.disconnect();
  }, [isLoaded]);
  const [online, setOnline] = useState(true);
  const [modal, setModal] = useState<
    | "player"
    | "court"
    | "database"
    | "history"
    | "summary"
    | "help"
    | "tour"
    | null
  >(null);
  const dialogMatchTime = useRef<number | null>(null);
  const [teamEditor, setTeamEditor] = useState<{
    kind: "court" | "queue"; id: string; title: string; original: TeamSlots;
    status: "idle" | "active"; startTime: number | null;
  } | null>(null);
  const [finishCourt, setFinishCourt] = useState<Court | undefined>();
  const [finishId, setFinishId] = useState<string | null>(null);
  const [stopId, setStopId] = useState<string | null>(null);
  const [transferCourt, setTransferCourt] = useState<Court | undefined>();
  const [transferId, setTransferId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [queueCourtId, setQueueCourtId] = useState<string | null>(null);
  const [assignId, setAssignId] = useState<string | null>(null);
  const [addPlayerMode, setAddPlayerMode] = useState<"close" | "keep">("close");
  const [addPlayerForm] = Form.useForm();
  const [addCourtForm] = Form.useForm();
  const [finishForm] = Form.useForm();
  const [stopForm] = Form.useForm();
  const { confirm, holder: confirmationHolder } = useConfirmation();
  const [toast, contextHolder] = message.useMessage();
  const frozenTime = sessionStatus === "ended" ? sessionEndTime : null;
  const disabled = !isLoaded || sessionStatus === "ended";
  const report = async (promise: Promise<ActionResult>) => {
    const result = await promise;
    if (!result.ok) toast.error(result.error);
    return result;
  };
  const playerName = (id: string) =>
    players.find((p) => p.id === id)?.name ?? "this player";
  const courtName = (id: string) =>
    courts.find((c) => c.id === id)?.name ?? "this court";
  const toggleSelection = (courtId: string, playerId: string) => {
    const currentCourt = courts.find((c) => c.players.includes(playerId));
    if (currentCourt)
      return confirm(
        currentCourt.id === courtId
          ? `Remove ${playerName(playerId)} from ${courtName(courtId)}?`
          : `Move ${playerName(playerId)} to ${courtName(courtId)}?`,
        `This will remove their assignment on ${currentCourt.name}.`,
        currentCourt.id === courtId ? "Remove player" : "Move player",
        () => report(actions.togglePlayerSelection(courtId, playerId)),
      );
    return report(actions.togglePlayerSelection(courtId, playerId));
  };
  const navigate = (next: View) => {
    scroll.current[view] = window.scrollY;
    setView(next);
    if (next !== "players") setTabletView(next);
    requestAnimationFrame(() => {
      if (window.innerWidth < 768)
        window.scrollTo({ top: scroll.current[next] });
      else
        sectionRefs.current[next]?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    });
  };
  useEffect(() => {
    document.body.dataset.queueDensity = activeDensity;
    return () => {
      delete document.body.dataset.queueDensity;
    };
  }, [activeDensity]);
  useEffect(() => {
    let cancelled = false;
    let controller: AbortController | undefined;
    const check = async () => {
      if (!navigator.onLine) {
        setOnline(false);
        return;
      }
      controller?.abort();
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 3000);
      try {
        const response = await fetch("/api/ping", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!cancelled) setOnline(response.ok);
      } catch {
        if (!cancelled) setOnline(false);
      } finally {
        clearTimeout(timeout);
      }
    };
    const offline = () => setOnline(false);
    void check();
    window.addEventListener("online", check);
    window.addEventListener("offline", offline);
    const timer = setInterval(check, 15000);
    return () => {
      cancelled = true;
      controller?.abort();
      clearInterval(timer);
      window.removeEventListener("online", check);
      window.removeEventListener("offline", offline);
    };
  }, []);
  useEffect(() => {
    if (
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    )
      return;
    const setup = async () => {
      const url = new URL(location.href);
      if (url.searchParams.get("sw") === "refresh") {
        for (const reg of await navigator.serviceWorker.getRegistrations())
          if (reg.active?.scriptURL.endsWith("/badminton-sw.js"))
            await reg.unregister();
        for (const key of await caches.keys())
          if (key.startsWith("badminton-queue-")) await caches.delete(key);
        url.searchParams.delete("sw");
        location.replace(url);
        return;
      }
      await navigator.serviceWorker.register("/badminton-sw.js");
    };
    void setup().catch(() => {
      toast.warning(
        "Offline files could not be updated. Your saved session is unaffected.",
      );
    });
  }, [toast]);
  const close = () => setModal(null);
  const assignedCourt = courts.find((c) => c.id === assignId);
  const saveDensity = (value: Density) => {
    try {
      localStorage.setItem(densityKey, value);
      setDensityFallback(null);
      window.dispatchEvent(new Event("queue-density"));
    } catch {
      setDensityFallback(value);
      toast.warning(
        "Density changed for this visit. Browser preferences could not be saved.",
      );
    }
  };
  return (
    <ConfigProvider
      theme={{
        cssVar: { prefix: "ant" },
        algorithm: appearance.dark
          ? theme.darkAlgorithm
          : theme.defaultAlgorithm,
        token: {
          colorPrimary: appearance.dark
            ? { emerald: "#34d399", ocean: "#38bdf8", violet: "#a78bfa" }[
                appearance.color
              ]
            : primary,
          colorInfo: primary,
          colorText: appearance.dark ? "#e6edf3" : "#172b26",
          colorTextSecondary: appearance.dark ? "#a6b4c2" : "#5e706a",
          colorBorder: appearance.dark ? "#344352" : "#dce5e0",
          colorBgLayout: appearance.dark ? "#101820" : "#f5f7f6",
          borderRadius: 8,
          fontSize: activeDensity === "compact" ? 14 : 16,
          controlHeight: activeDensity === "compact" ? 32 : 40,
        },
        components: {
          Card: { bodyPadding: activeDensity === "compact" ? 12 : 20 },
          Modal: {
            paddingContentHorizontalLG: activeDensity === "compact" ? 20 : 28,
          },
        },
      }}
    >
      {contextHolder}
      {confirmationHolder}
      <div
        className={styles.layout}
        ref={workspaceRef}
        data-theme={appearance.color}
        data-mode={appearance.dark ? "dark" : "light"}
        data-density={activeDensity}
        data-view={view}
        data-tablet-view={tabletView}
      >
        <QueuingHeader
          appearance={appearance}
          playerCount={players.length}
          courtCount={courts.length}
          queueCount={queue.length}
          sessionStartTime={sessionStartTime}
          sessionEndTime={sessionEndTime}
          sessionStatus={sessionStatus}
          frozenTime={frozenTime}
          isOffline={!online}
          disabled={!isLoaded}
          onStartSession={() => report(actions.startSession())}
          onStopSession={async () => {
            const result = await report(actions.stopSession());
            if (result.ok) setModal("summary");
            return result;
          }}
          onResetSession={() => report(actions.resetState())}
          onRestartSession={() => report(actions.restartSession())}
          onOpenPayments={() => openPayments()}
          onOpenHistory={() => setModal("history")}
          onOpenSummary={() => setModal("summary")}
          onPopulateDummy={() => {
            void report(
              actions.populateDummyPlayers([
                "Beginner",
                "Intermediate",
                "Advanced",
              ]),
            );
          }}
          onOpenInstructions={() => setModal("help")}
          onStartTour={() => setModal("tour")}
          onExportSession={actions.exportSession}
          onImportSession={async (text) => {
            try {
              parseSession(JSON.parse(text));
            } catch (error) {
              const message = errorText(error);
              toast.error(message);
              return { ok: false, error: message };
            }
            const result = await confirm(
              "Replace the current session?",
              "Importing replaces the current players, courts, queue, results, player logs, session statistics, expenses, and payments. Export the current session first if you need a copy.",
              "Replace session",
              () => report(actions.importSession(text)),
            );
            if (result.ok) toast.success("Session imported");
            return result;
          }}
        />
        <main className={styles.content}>
          <div className={styles.pageHeading}>
            <div>
              <p className={styles.sessionStats}>
                <span>{players.length} players</span>
                <span>{courts.filter((c) => c.status === "active").length}/{courts.length} courts playing</span>
                <span>{history.filter((h) => !h.isStopped).length} matches finished</span>
                <span title="Completed games per player, averaged across the session roster">
                  {players.length ? (players.reduce((total, player) => total + player.gamesPlayed, 0) / players.length).toFixed(1) : "0.0"} avg games/player
                </span>
              </p>
            </div>
            <div className={styles.densityControl}>
              <span>Density</span>
              <Segmented
                aria-label="Display density"
                value={activeDensity}
                onChange={saveDensity}
                options={[
                  { label: "Compact", value: "compact" },
                  { label: "Comfortable", value: "comfortable" },
                ]}
              />
            </div>
          </div>
          {state.storageError && (
            <Alert
              type="error"
              showIcon
              title="Changes could not be saved"
              description={state.storageError}
              action={
                <Button
                  onClick={() => {
                    void actions.retryStorage();
                  }}
                >
                  Retry loading
                </Button>
              }
            />
          )}
          {!isLoaded ? (
            <div className={styles.loading}>
              <Spin />
              <p>Loading your saved session…</p>
            </div>
          ) : (
            <>
              {sessionStatus === "ended" && (
                <Alert
                  type="info"
                  title="Session complete"
                  description="View your summary or use Session → New session to keep playing with this roster."
                />
              )}
              <div className={styles.dashboard}>
                <section
                  className={`${styles.section} ${styles.playersSection}`}
                  ref={(el) => {
                    sectionRefs.current.players = el;
                  }}
                >
                  <PlayerPanel
                    header={
                      <div className={styles.sectionHeading}>
                        <div>
                          <h2>
                            Players <span>{players.length}</span>
                          </h2>
                          <p>
                            {
                              players.filter(
                                (p) =>
                                  isWaitingPlayer(p, courts, queue),
                              ).length
                            }{" "}
                            waiting ·{" "}
                            {
                              players.filter(
                                (p) => isCheckedIn(p) && !p.isActive,
                              ).length
                            }{" "}
                            away · {players.filter(isCheckedIn).length}/
                            {players.length} present ·{" "}
                            {players.filter((p) => !isCheckedIn(p)).length} not
                            arrived
                          </p>
                        </div>
                        <div className={styles.inline}>
                          <Button
                            disabled={disabled}
                            onClick={() => setModal("database")}
                          >
                            Player Database
                          </Button>
                          <Button
                            type="primary"
                            disabled={disabled}
                            icon={<PlusOutlined aria-hidden="true" />}
                            onClick={() => setModal("player")}
                          >
                            Add Player
                          </Button>
                        </div>
                      </div>
                    }
                    paymentTags={paymentTags}
                    players={players}
                    courts={courts}
                    queue={queue}
                    onCheckIn={(id) => report(actions.checkInPlayer(id))}
                    onUndoCheckIn={(id) =>
                      confirm(
                        `Undo check-in for ${playerName(id)}?`,
                        "This marks the player as not arrived and removes any pending court or queue assignments. Match history is kept.",
                        "Undo check-in",
                        () => report(actions.undoCheckIn(id)),
                      )
                    }
                    frozenTime={frozenTime}
                    sessionStartTime={sessionStartTime}
                    disabled={disabled}
                    onToggleSelection={(c, p) => toggleSelection(c, p)}
                    onRenamePlayer={(id, name) => report(actions.renamePlayer(id, name))}
                    onViewPlayer={setPlayerId}
                    onRemovePlayer={(id) =>
                      confirm(
                        `Remove ${playerName(id)} from this session?`,
                        "This removes their pending court and queue assignments. Match history and the reusable player database are kept.",
                        "Remove player",
                        () => report(actions.removePlayer(id)),
                      )
                    }
                    onToggleActive={(id) =>
                      players.find((p) => p.id === id)?.isActive &&
                      (courts.some((c) => c.players.includes(id)) ||
                        queue.some((q) =>
                          [...q.team1, ...q.team2].includes(id),
                        ))
                        ? confirm(
                            `Mark ${playerName(id)} away?`,
                            "Their pending court and queue assignments will be removed.",
                            "Mark away",
                            () => report(actions.togglePlayerActive(id)),
                          )
                        : report(actions.togglePlayerActive(id))
                    }
                    onCreateQueue={() => report(actions.createQueueItem())}
                    onAddPlayerToQueue={(q, p) =>
                      report(actions.addPlayerToQueueItem(q, p))
                    }
                  />
                </section>
                <aside
                  className={styles.sidebar}
                  aria-label="Queue and courts"
                  data-has-queue={queue.length > 0}
                  data-queue-minimized={queueMinimized || queueHidden}
                  data-queue-hidden={queueHidden}
                >
                  <div className={styles.tabletTabs}>
                    <Segmented
                      aria-label="Session panel"
                      value={tabletView}
                      onChange={setTabletView}
                      options={[
                        { label: `Queue (${queue.length})`, value: "queue" },
                        {
                          label: `Courts (${courts.length})`,
                          value: "courts",
                        },
                      ]}
                    />
                  </div>
                  <section
                    className={`${styles.section} ${styles.queueSection}`}
                    ref={(el) => {
                      sectionRefs.current.queue = el;
                    }}
                  >
                    <div className={styles.sectionHeading}>
                      <div>
                        <h2>
                          Up next <span>{queue.length}</span>
                        </h2>
                        <p>Line up the next good game.</p>
                      </div>
                      <div className={styles.inline}>
                        {(queue.length > 0 || queueHidden) && (
                          <Button
                            aria-expanded={!queueMinimized && !queueHidden}
                            aria-controls="up-next-content"
                            onClick={() => {
                              setQueueHidden(false);
                              setQueueMinimized(queueHidden ? false : !queueMinimized);
                            }}
                          >
                            {queueHidden || queueMinimized ? "Expand" : "Minimize"}
                          </Button>
                        )}
                        {queue.length > 0 && !queueHidden && (
                          <Button
                            aria-controls="up-next-content"
                            aria-expanded={false}
                            onClick={() => { setQueueHidden(true); setQueueMinimized(true); }}
                          >
                            Hide
                          </Button>
                        )}
                        <Button
                          className={styles.createMatchButton}
                          disabled={disabled}
                          icon={<PlusOutlined aria-hidden="true" />}
                          onClick={async () => {
                            setQueueHidden(false);
                            setQueueMinimized(false);
                            if ((await report(actions.createQueueItem())).ok)
                              toast.success(
                                "Match created. Add players from the roster.",
                              );
                          }}
                        >
                          Create Match
                        </Button>
                      </div>
                    </div>
                    <div id="up-next-content" hidden={queueHidden}>
                      <QueueTab
                        onChangeTeams={(id) => {
                          const item = queue.find((q) => q.id === id)!;
                          setTeamEditor({ kind: "queue", id, title: `Match ${queue.indexOf(item) + 1}`, original: queueSlots(item) as TeamSlots, status: "idle", startTime: null });
                        }}
                        minimized={queueMinimized}
                        queue={queue}
                        players={players}
                        courts={courts}
                        disabled={disabled}
                        onAssignToCourt={(q, c) =>
                          report(actions.assignQueueToCourt(q, c))
                        }
                        onRemoveQueueItem={(id) =>
                          confirm(
                            "Remove this queued match?",
                            "The match and its pending team assignments will be removed. Players remain in the roster.",
                            "Remove match",
                            () => report(actions.removeQueueItem(id)),
                          )
                        }
                        onMoveQueueItem={(f, t) =>
                          report(actions.moveQueueItem(f, t))
                        }
                        onRemovePlayerFromQueue={(q, p) =>
                          confirm(
                            `Remove ${playerName(p)} from this queued match?`,
                            "The player will remain in the session roster.",
                            "Remove player",
                            () => report(actions.removePlayerFromQueue(q, p)),
                          )
                        }
                        onRemovePlayersFromQueue={(id) =>
                          confirm(
                            "Clear this queued match?",
                            "Both teams will be emptied. The match stays in the queue.",
                            "Clear players",
                            () => report(actions.removePlayersFromQueue(id)),
                          )
                        }
                        onAddPlayers={() => navigate("players")}
                      />
                    </div>
                  </section>
                  <section
                    className={`${styles.section} ${styles.courtsSection}`}
                    ref={(el) => {
                      sectionRefs.current.courts = el;
                    }}
                  >
                    <div className={styles.sectionHeading}>
                      <div>
                        <h2>
                          Courts <span>{courts.length}</span>
                        </h2>
                        <p>The action, at a glance.</p>
                      </div>
                      <Button
                        disabled={disabled}
                        icon={<PlusOutlined aria-hidden="true" />}
                        onClick={() => setModal("court")}
                      >
                        Add Court
                      </Button>
                    </div>
                    <div className={styles.courtsGrid}>
                      {courts.map((court) => (
                        <CourtCard
                          onChangeTeams={() => setTeamEditor({ kind: "court", id: court.id, title: court.name, original: [...court.players] as TeamSlots, status: court.status, startTime: court.startTime })}
                          key={court.id}
                          court={court}
                          players={players}
                          frozenTime={frozenTime}
                          sessionStartTime={
                            sessionStatus === "active" ? sessionStartTime : null
                          }
                          disabled={disabled}
                          onUpdateName={(id, name) =>
                            report(actions.updateCourtName(id, name))
                          }
                          onRemove={(id) =>
                            confirm(
                              `Remove ${courtName(id)}?`,
                              "Players assigned to this court will return to the roster. Court history is kept.",
                              "Remove court",
                              () => report(actions.removeCourt(id)),
                            )
                          }
                          onStartMatch={(id) => report(actions.startMatch(id))}
                          onFinishMatch={(id) => {
                            dialogMatchTime.current = court.startTime;
                            finishForm.resetFields();
                            setFinishCourt(structuredClone(court));
                            setFinishId(id);
                          }}
                          onStopAndQueue={(id) => {
                            const startTime = court.startTime;
                            void confirm(
                              `Stop ${court.name} and move players to queue?`,
                              "The match will be recorded as stopped without a winner. The same teams will be added to the end of Up next and the court will be cleared.",
                              "Stop and move to queue",
                              async () => {
                                const result = await report(actions.stopMatchAndQueue(id, startTime));
                                if (result.ok) {
                                  setQueueHidden(false);
                                  setQueueMinimized(false);
                                  toast.success("Match stopped and teams moved to queue");
                                }
                                return result;
                              },
                            );
                          }}
                          onStopMatch={(id) => {
                            dialogMatchTime.current = court.startTime;
                            setStopId(id);
                          }}
                          onTransfer={(id) => {
                            dialogMatchTime.current = court.startTime;
                            setTransferCourt(structuredClone(court));
                            setTransferId(id);
                          }}
                          onTogglePlayer={(c, p) => toggleSelection(c, p)}
                          onClearCourt={(id) =>
                            confirm(
                              `Clear players from ${courtName(id)}?`,
                              "All pending player assignments on this court will be removed.",
                              "Clear court",
                              () => report(actions.clearCourt(id)),
                            )
                          }
                          onAssignFromQueue={setQueueCourtId}
                          onMoveToQueue={(id) => {
                            const original = [...court.players];
                            return confirm(
                              `Move all players from ${courtName(id)} to queue?`,
                              "The lineup will be added to the end of Up next, keeping both teams. The court will be empty.",
                              "Move all to queue",
                              async () => {
                                const result = await report(actions.moveCourtToQueue(id, original));
                                if (result.ok) { setQueueHidden(false); setQueueMinimized(false); }
                                return result;
                              },
                            );
                          }}
                          onAssignPlayers={setAssignId}
                        />
                      ))}
                    </div>
                    {!courts.length && (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="Add a court to set up your first match."
                      />
                    )}
                  </section>
                </aside>
              </div>
            </>
          )}
        </main>
        <nav className={styles.mobileNav} aria-label="Session views">
          {(
            [
              {
                key: "players",
                label: "Players",
                count: players.length,
                icon: <TeamOutlined />,
              },
              {
                key: "queue",
                label: "Queue",
                count: queue.length,
                icon: <OrderedListOutlined />,
              },
              {
                key: "courts",
                label: "Courts",
                count: courts.length,
                icon: <AppstoreOutlined />,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              aria-current={view === tab.key ? "page" : undefined}
              onClick={() => navigate(tab.key)}
            >
              {tab.icon}
              <span>
                {tab.label} <b>{tab.count}</b>
              </span>
            </button>
          ))}
        </nav>
        <AddPlayerModal
          visible={modal === "player"}
          onCancel={close}
          form={addPlayerForm}
          mode={addPlayerMode}
          setMode={setAddPlayerMode}
          onAdd={async (values: {
            name: string;
            level: PlayerLevel;
            gender: Gender;
          }) => {
            if ((await report(actions.addPlayer(values))).ok) {
              addPlayerForm.resetFields(["name"]);
              if (addPlayerMode === "close") close();
              toast.success(`${values.name} added`);
            }
          }}
        />
        <AddCourtModal
          visible={modal === "court"}
          onCancel={close}
          form={addCourtForm}
          onCreate={async (values) => {
            if ((await report(actions.addCourt(values.name))).ok) {
              addCourtForm.resetFields();
              close();
            }
          }}
        />
        {teamEditor && (
          <ChangeTeamsModal
            title={teamEditor.title}
            courts={courts}
            queue={queue}
            original={teamEditor.original}
            active={teamEditor.status === "active"}
            queued={teamEditor.kind === "queue"}
            players={players}
            disabled={disabled}
            onCancel={() => setTeamEditor(null)}
            onSave={(lineup) => {
              const change = { original: teamEditor.original, players: lineup };
              return teamEditor.kind === "court"
                ? actions.changeCourtTeams(teamEditor.id, change, teamEditor.status, teamEditor.startTime)
                : actions.changeQueueTeams(teamEditor.id, change);
            }}
          />
        )}
        <FinishMatchModal
          visible={!!finishId}
          onCancel={() => {
            finishForm.resetFields();
            setFinishId(null);
          }}
          form={finishForm}
          court={finishCourt}
          players={players}
          onFinish={async (values) => {
            if (
              finishId &&
              (
                await report(
                  actions.finishMatch(
                    finishId,
                    values,
                    dialogMatchTime.current,
                    finishCourt?.players,
                  ),
                )
              ).ok
            ) {
              finishForm.resetFields();
              setFinishId(null);
              toast.success("Match saved");
            }
          }}
        />
        <StopMatchModal
          visible={!!stopId}
          onCancel={() => setStopId(null)}
          form={stopForm}
          onStop={async (values) => {
            if (
              stopId &&
              (
                await report(
                  actions.stopMatch(
                    stopId,
                    values.reason?.trim() ?? "",
                    dialogMatchTime.current,
                  ),
                )
              ).ok
            ) {
              stopForm.resetFields();
              setStopId(null);
            }
          }}
        />
        <TransferCourtModal
          visible={!!transferId}
          onCancel={() => setTransferId(null)}
          courts={courts}
          currentCourt={transferCourt}
          onTransfer={async (target) => {
            if (!transferId || !transferCourt)
              return { ok: false, error: "Select a court first" };
            const result = await report(
              actions.transferMatch(
                transferId,
                target,
                transferCourt,
              ),
            );
            if (result.ok) setTransferId(null);
            return result;
          }}
        />
        <HistoryModal
          visible={modal === "history"}
          onCancel={close}
          history={history}
        />
        <SessionSummaryModal
          onOpenPayments={
            sessionStatus === "ended"
              ? () => {
                  setModal(null);
                  openPayments();
                }
              : undefined
          }
          visible={modal === "summary"}
          onClose={close}
          sessionStartTime={sessionStartTime}
          sessionEndTime={sessionEndTime}
          frozenTime={frozenTime}
          players={players}
          courts={courts}
          history={history}
          courtHistory={courtHistory}
        />
        {paymentsOpen && (
          <PaymentsPanel
            key={paymentPlayer ?? "all"}
            session={state}
            actions={actions}
            open
            close={() => setPaymentsOpen(false)}
            playerFilter={paymentPlayer}
          />
        )}
        <InstructionsModal visible={modal === "help"} onClose={close} />
        <PlayerDetailsModal
          onOpenPayments={(id) => {
            setPlayerId(null);
            openPayments(id);
          }}
          visible={!!playerId}
          onCancel={() => setPlayerId(null)}
          player={players.find((p) => p.id === playerId)}
          playerLogs={state.playerLogs}
          sessionStartTime={sessionStartTime}
          frozenTime={frozenTime}
          players={players}
          history={history}
          onUpdateLevel={(id, level) => {
            void report(actions.updatePlayerLevel(id, level));
          }}
          onUpdateGender={(id, gender) => {
            void report(actions.updatePlayerGender(id, gender));
          }}
        />
        <PlayersDatabaseModal
          visible={modal === "database"}
          onClose={close}
          existingPlayers={players.map((p) => p.name)}
          onAddToSession={async (list) => {
            let count = 0;
            let success = true;
            for (const values of list) {
              if (
                players.some(
                  (p) => p.name.toLowerCase() === values.name.toLowerCase(),
                )
              )
                continue;
              if ((await report(actions.addPlayer(values))).ok) count++;
              else success = false;
            }
            if (count) toast.success(`Added ${count} players`);
            return success;
          }}
        />
        <Modal
          title={`Assign from queue · ${courts.find((c) => c.id === queueCourtId)?.name ?? "Court"}`}
          open={!!queueCourtId}
          onCancel={() => setQueueCourtId(null)}
          footer={<Button onClick={() => setQueueCourtId(null)}>Cancel</Button>}
        >
          <div className={styles.queuePickerList}>
          {!queue.length && <p>No queued matches. Create a match in Up next first.</p>}
          {queue.map((item, index) => {
            const ids = [...item.team1, ...item.team2];
            const unavailable = ids.filter((id) => {
              const p = players.find((p) => p.id === id);
              return !p || !isCheckedIn(p) || !p.isActive || p.isPlaying || courts.some((c) => c.players.includes(id));
            });
            const target = courts.find((c) => c.id === queueCourtId);
            const reason = !ids.length ? "No players assigned" : unavailable.length
              ? `Unavailable: ${unavailable.map((id) => players.find((p) => p.id === id)?.name ?? "Unknown player").join(", ")}. Players must be checked in, active, and free of court assignments.`
              : "Ready to assign";
            return (
              <section className={styles.queuePickerOption} key={item.id} aria-label={`Queue option ${index + 1}`}>
                <div className={styles.queuePickerDetails}>
                <strong>Match {index + 1} · {ids.length}/4 players</strong>
                {[item.team1, item.team2].map((team, i) => (
                  <div key={i} className={styles.queuePickerTeam}>
                    <span>Team {i + 1}:</span>
                    {team.length ? team.map((id) => {
                      const member = players.find((p) => p.id === id);
                      return <span className={styles.queuePickerMember} key={id}><span>{member?.name ?? "Unknown player"}</span>{member && <LevelTag level={member.level} />}</span>;
                    }) : "Empty"}
                  </div>
                ))}
                {reason !== "Ready to assign" && <p className={styles.queuePickerReason}>{reason}</p>}
                </div>
                <Button
                  aria-label={`Assign match ${index + 1}`}
                  disabled={disabled || !ids.length || !!unavailable.length || !target || target.status !== "idle" || target.players.some(Boolean)}
                  onClick={async () => {
                    if (queueCourtId && (await report(actions.assignQueueToCourt(item.id, queueCourtId))).ok)
                      setQueueCourtId(null);
                  }}
                >Assign</Button>
              </section>
            );
          })}
          </div>
        </Modal>
        <Modal
          title={`Assign players · ${assignedCourt?.name ?? "Court"}`}
          open={!!assignId}
          onCancel={() => setAssignId(null)}
          footer={
            <Button type="primary" onClick={() => setAssignId(null)}>
              Done
            </Button>
          }
        >
          <p>
            Select available players. Each match needs two players on each team.
          </p>
          <Select
            aria-label="Choose player for court"
            style={{ width: "100%" }}
            showSearch
            optionFilterProp="label"
            value={null}
            placeholder="Choose an available player"
            disabled={
              !assignedCourt?.players.includes(null) ||
              assignedCourt.status !== "idle"
            }
            options={players
              .filter(
                (p) =>
                  isCheckedIn(p) &&
                  p.isActive &&
                  !p.isPlaying &&
                  !courts.some((c) => c.players.includes(p.id)) &&
                  !queue.some((q) => [...q.team1, ...q.team2].includes(p.id)),
              )
              .map((p) => ({ value: p.id, label: `${p.name} · ${p.level}` }))}
            onChange={async (id) => {
              if (assignId && id)
                await report(actions.togglePlayerSelection(assignId, id));
            }}
          />
          <p>{assignedCourt?.players.filter(Boolean).length ?? 0}/4 assigned</p>
        </Modal>
        <Modal
          title="A quick courtside guide"
          open={modal === "tour"}
          onCancel={close}
          footer={
            <Button type="primary" onClick={close}>
              Got it
            </Button>
          }
        >
          <Steps
            direction="vertical"
            items={[
              {
                title: "Set up",
                description:
                  "Add your courts and players, then start the session.",
              },
              {
                title: "Line up matches",
                description:
                  "Create a match in Up next. Use Queue on each player, even while they are playing. Assign the upcoming match to an empty court once everyone is available.",
              },
              {
                title: "Play and record",
                description:
                  "Start a ready court. Finish with a winner and optional scores, or stop an interrupted match.",
              },
              {
                title: "Wrap up",
                description:
                  "Finish all running matches, stop the session, and review or export your results.",
              },
            ]}
          />
        </Modal>
      </div>
    </ConfigProvider>
  );
}

QueuingClient.displayName = "QueuingClient";

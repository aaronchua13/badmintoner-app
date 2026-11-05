import LevelTag from "./LevelTag";
import React, { useMemo } from "react";
import { Button, Dropdown, Empty, Tag } from "antd";
import { ManOutlined, WomanOutlined, MoreOutlined } from "@ant-design/icons";
import { Player, Court, QueueItem, isCheckedIn } from "../types";
import { ActionResult } from "../state/model";
import {
  getWaitTime,
  getTotalIdleTime,
  formatDuration,
  getCurrentWaitDuration,
  getWaitPriority,
} from "../utils";
import styles from "../QueuingClient.module.css";
import { useVisibleTime } from "../hooks/useCurrentTime";
import { useStableEvent } from "../hooks/useStableEvent";
interface Props {
  paymentTags?: Record<string, React.ReactNode>;
  sortedPlayers: Player[];
  courts: Court[];
  queue: QueueItem[];
  playerViewMode: "list" | "grid";
  sessionStartTime: number | null;
  frozenTime: number | null;
  disabled?: boolean;
  onToggleSelection: (court: string, player: string) => Promise<ActionResult>;
  onRenamePlayer: (id: string) => void;
  onViewPlayer: (id: string) => void;
  onRemovePlayer: (id: string) => Promise<ActionResult>;
  onToggleActive: (id: string) => Promise<ActionResult>;
  onCheckIn: (id: string) => Promise<ActionResult>;
  onUndoCheckIn: (id: string) => Promise<ActionResult>;
  onAddToQueue: (id: string) => void;
}
export default function PlayerList(p: Props) {
  const assignments = useMemo(() => {
    const courts = new Map<string, Court>();
    const queued = new Set<string>();
    for (const court of p.courts) for (const id of court.players) if (id) courts.set(id, court);
    for (const item of p.queue) for (const id of [...item.team1, ...item.team2]) queued.add(id);
    return { courts, queued };
  }, [p.courts, p.queue]);
  const handlers = {
    onToggleSelection: useStableEvent(p.onToggleSelection),
    onRenamePlayer: useStableEvent(p.onRenamePlayer),
    onViewPlayer: useStableEvent(p.onViewPlayer),
    onRemovePlayer: useStableEvent(p.onRemovePlayer),
    onToggleActive: useStableEvent(p.onToggleActive),
    onCheckIn: useStableEvent(p.onCheckIn),
    onUndoCheckIn: useStableEvent(p.onUndoCheckIn),
    onAddToQueue: useStableEvent(p.onAddToQueue),
  };
  if (!p.sortedPlayers.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No players match this view. Add players or adjust your filters." />;
  return <div className={p.playerViewMode === "grid" ? styles.playerGrid : styles.playerRows}>
    {p.sortedPlayers.map((player) => {
      const court = assignments.courts.get(player.id);
      const queued = assignments.queued.has(player.id);
      return <PlayerRow key={player.id} player={player} court={court} queued={queued}
        queueable={isCheckedIn(player) && player.isActive && court?.status !== "idle" && !queued}
        paymentTag={p.paymentTags?.[player.id]} courts={p.courts} disabled={p.disabled}
        sessionStartTime={p.sessionStartTime} frozenTime={p.frozenTime} {...handlers} />;
    })}
  </div>;
}
type RowProps = Omit<Props, "sortedPlayers" | "queue" | "paymentTags" | "playerViewMode"> & {
  player: Player; court?: Court; queued: boolean; queueable: boolean; paymentTag?: React.ReactNode;
};
const PlayerRow = React.memo(function PlayerRow(p: RowProps) {
  const { player, court, queued } = p;
  const present = isCheckedIn(player);
  const available =
    present && player.isActive && !player.isPlaying && !queued;
  const assigned = available && !!court;
  return (
    <div
      className={styles.playerRow}
      data-testid="player-row"
      data-player-status={
        !present
          ? "not-arrived"
          : player.isPlaying
            ? "playing"
            : queued
              ? "queued"
              : !player.isActive
                ? "away"
                : court
                  ? "assigned"
                  : "waiting"
      }
      key={player.id}
    >
      <button
        className={styles.nameButton}
        onClick={() => p.onViewPlayer(player.id)}
      >
        <span className={styles.playerInitial} aria-hidden="true">
          {player.name.charAt(0).toUpperCase()}
        </span>
        <span
          className={styles.attendanceMark}
          title={present ? `Present · checked in ${new Date(player.checkedInAt ?? player.joinedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Not arrived"}
          aria-hidden="true"
        >
          {present ? "✓" : "○"}
        </span>
        <span className={styles.playerIdentity}>
          <strong title={player.name}>
            <span className={styles.genderIcon} data-gender={player.gender} role="img" aria-label={player.gender} title={player.gender}>
              {player.gender === "Female" ? <WomanOutlined aria-hidden="true" /> : <ManOutlined aria-hidden="true" />}
            </span>
            {player.name}
          </strong>
          {p.paymentTag}
        </span>
      </button>
      <span className={styles.rosterLevel} data-label="Level">
        <LevelTag level={player.level} />
      </span>
      <PlayerTimes player={player} sessionStartTime={p.sessionStartTime} frozenTime={p.frozenTime} />
      <span className={styles.playerStat} data-label="Games">
        <strong>{player.gamesPlayed}</strong>
        <small>games</small>
      </span>
      <Tag
        color={player.isPlaying ? "green" : queued ? "gold" : assigned ? "blue" : "default"}
        title={assigned ? `Assigned to ${court?.name}` : undefined}
        aria-label={assigned ? `Assigned to ${court?.name}` : undefined}
      >
        {!present
          ? "Not arrived"
          : player.isPlaying
            ? queued ? "Playing · Queued" : "Playing"
            : queued
              ? "Queued"
              : !player.isActive
                ? "Away"
                : court
                  ? "Assigned"
                  : "Waiting"}
      </Tag>
      <div className={styles.rowActions}>
        {!present ? (
          <Button
            type="primary"
            disabled={p.disabled}
            onClick={() => {
              void p.onCheckIn(player.id);
            }}
          >
            Check in
          </Button>
        ) : (
          <>
            <Button
              disabled={p.disabled || !p.queueable}
              onClick={() => p.onAddToQueue(player.id)}
            >
              Queue
            </Button>
            <Dropdown
              trigger={["click"]}
              menu={{
                items: p.courts
                  .filter(
                    (c) =>
                      c.status === "idle" &&
                      (c.players.includes(null) ||
                        c.players.includes(player.id)),
                  )
                  .map((c) => ({
                    key: c.id,
                    label: `${c.players.includes(player.id) ? "Remove from" : "Assign to"} ${c.name}`,
                    onClick: () => {
                      void p.onToggleSelection(c.id, player.id);
                    },
                  })),
              }}
            >
              <Button
                disabled={
                  p.disabled ||
                  !available ||
                  !p.courts.some(
                    (c) =>
                      c.status === "idle" &&
                      (c.players.includes(null) ||
                        c.players.includes(player.id)),
                  )
                }
              >
                Court
              </Button>
            </Dropdown>
          </>
        )}
        <Dropdown
          trigger={["click"]}
          menu={{
            items: [
              {
                key: "rename",
                label: "Rename player",
                disabled: p.disabled,
                onClick: () => p.onRenamePlayer(player.id),
              },
              {
                key: "details",
                label: "Player details",
                onClick: () => p.onViewPlayer(player.id),
              },
              {
                key: "active",
                label: player.isActive ? "Mark away" : "Mark available",
                disabled: p.disabled || player.isPlaying || !present,
                onClick: () => {
                  void p.onToggleActive(player.id);
                },
              },
              {
                key: "undo-check-in",
                label: "Undo check-in",
                disabled: p.disabled || !present || player.isPlaying,
                onClick: () => {
                  void p.onUndoCheckIn(player.id);
                },
              },
              {
                key: "remove",
                label: "Remove player",
                danger: true,
                disabled: p.disabled || player.isPlaying,
                onClick: () => {
                  void p.onRemovePlayer(player.id);
                },
              },
            ],
          }}
        >
          <Button
            type="text"
            icon={<MoreOutlined />}
            aria-label={`Options for ${player.name}`}
          />
        </Dropdown>
      </div>
    </div>
  );
});
const PlayerTimes = React.memo(function PlayerTimes(p: { player: Player; sessionStartTime: number | null; frozenTime: number | null }) {
  const { player } = p;
  const { ref, currentTime } = useVisibleTime(p.frozenTime, p.sessionStartTime !== null && isCheckedIn(player) && !player.isPlaying);
  const waitPriority = getWaitPriority(getCurrentWaitDuration(player, p.sessionStartTime, currentTime));
  return (
    <>
      <span ref={ref} className={styles.playerStat} data-label="Current idle">
        <strong
          className={styles.waitValue}
          data-wait-priority={waitPriority}
          title={
            waitPriority === "urgent"
              ? "Long wait: 20 minutes or more"
              : waitPriority === "warning"
                ? "Long wait: 15 minutes or more"
                : undefined
          }
        >
          {getWaitTime(player, p.sessionStartTime, currentTime)}
        </strong>
        <small>current idle</small>
      </span>
      <span className={styles.playerStat} data-label="Total idle">
        <strong>
          {formatDuration(
            getTotalIdleTime(player, p.sessionStartTime, currentTime),
          )}
        </strong>
        <small>total idle</small>
      </span>
    </>
  );
});

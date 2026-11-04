import React from "react";
import { Button, Dropdown, Empty, Tag } from "antd";
import { MoreOutlined } from "@ant-design/icons";
import { Player, Court, QueueItem, isCheckedIn } from "../types";
import { ActionResult } from "../state/model";
import {
  getWaitTime,
  getWaitDuration,
  formatDuration,
  getCurrentWaitDuration,
  getWaitPriority,
} from "../utils";
import styles from "../QueuingClient.module.css";
interface Props {
  paymentTags?: Record<string, React.ReactNode>;
  sortedPlayers: Player[];
  courts: Court[];
  queue: QueueItem[];
  playerViewMode: "list" | "grid";
  sessionStartTime: number | null;
  currentTime: number;
  disabled?: boolean;
  onToggleSelection: (court: string, player: string) => Promise<ActionResult>;
  onViewPlayer: (id: string) => void;
  onRemovePlayer: (id: string) => Promise<ActionResult>;
  onToggleActive: (id: string) => Promise<ActionResult>;
  onCheckIn: (id: string) => Promise<ActionResult>;
  onUndoCheckIn: (id: string) => Promise<ActionResult>;
  onAddToQueue: (id: string) => void;
}
export default function PlayerList(p: Props) {
  if (!p.sortedPlayers.length)
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="No players match this view. Add players or adjust your filters."
      />
    );
  return (
    <div
      className={
        p.playerViewMode === "grid" ? styles.playerGrid : styles.playerRows
      }
    >
      {p.sortedPlayers.map((player) => {
        const queued = p.queue.some((q) =>
          [...q.team1, ...q.team2].includes(player.id),
        );
        const court = p.courts.find((c) => c.players.includes(player.id));
        const waitPriority = getWaitPriority(
          getCurrentWaitDuration(player, p.sessionStartTime, p.currentTime),
        );
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
                <strong title={player.name}>{player.name}</strong>
                {p.paymentTags?.[player.id]}
              </span>
            </button>
            <span className={styles.rosterLevel} data-label="Level">
              {player.level}
            </span>
            <span className={styles.playerStat} data-label="Current idle">
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
                {getWaitTime(player, p.sessionStartTime, p.currentTime)}
              </strong>
              <small>current idle</small>
            </span>
            <span className={styles.playerStat} data-label="Total idle">
              <strong>
                {formatDuration(
                  player.totalIdleTime +
                    Math.max(
                      0,
                      getWaitDuration(
                        player,
                        p.sessionStartTime,
                        p.currentTime,
                      ),
                    ),
                )}
              </strong>
              <small>total idle</small>
            </span>
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
                  ? "Playing"
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
                    disabled={p.disabled || !available || !!court}
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
      })}
    </div>
  );
}

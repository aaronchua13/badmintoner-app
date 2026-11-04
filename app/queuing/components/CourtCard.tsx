import React, { useState } from "react";
import { Button, Dropdown, Input, Modal, Tag } from "antd";
import {
  MoreOutlined,
  CloseOutlined,
  CaretRightFilled,
  CheckOutlined,
} from "@ant-design/icons";
import { Court, Player } from "../types";
import { ActionResult } from "../state/model";
import { formatMatchTime, getMatchOdds } from "../utils";
import styles from "../QueuingClient.module.css";
interface Props {
  court: Court;
  players: Player[];
  currentTime: number;
  sessionStartTime: number | null;
  disabled?: boolean;
  onUpdateName: (id: string, name: string) => Promise<ActionResult>;
  onRemove: (id: string) => Promise<ActionResult>;
  onStartMatch: (id: string) => Promise<ActionResult>;
  onFinishMatch: (id: string) => void;
  onStopMatch: (id: string) => void;
  onTransfer: (id: string) => void;
  onTogglePlayer: (court: string, player: string) => Promise<ActionResult>;
  onClearCourt: (id: string) => Promise<ActionResult>;
  onAssignPlayers: (id: string) => void;
}
export default function CourtCard({
  court,
  players,
  currentTime,
  sessionStartTime,
  disabled,
  onUpdateName,
  onRemove,
  onStartMatch,
  onFinishMatch,
  onStopMatch,
  onTransfer,
  onTogglePlayer,
  onClearCourt,
  onAssignPlayers,
}: Props) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(court.name);
  const active = court.status === "active";
  const count = court.players.filter(Boolean).length;
  const ready = count === 4;
  const odds = getMatchOdds(court.players, players);
  return (
    <article
      className={`${styles.courtCard} ${active ? styles.liveCourt : ""}`}
      aria-label={court.name}
    >
      <div className={styles.cardHeading}>
        <div>
          <span className={styles.eyebrow}>COURT</span>
          <h3>{court.name}</h3>
        </div>
        <div className={styles.inline}>
          <Tag
            color={active ? "green" : ready ? "orange" : "default"}
            icon={ready && !active ? <CaretRightFilled aria-hidden="true" /> : undefined}
          >
            {active ? "Playing" : ready ? "Ready" : "Needs players"}
          </Tag>
          <Dropdown
            trigger={["click"]}
            menu={{
              items: [
                {
                  key: "rename",
                  label: "Rename court",
                  disabled,
                  onClick: () => {
                    setName(court.name);
                    setRenaming(true);
                  },
                },
                {
                  key: "transfer",
                  label: "Transfer players / match",
                  disabled: disabled || !count,
                  onClick: () => onTransfer(court.id),
                },
                {
                  key: "clear",
                  label: "Clear players",
                  disabled: disabled || active || !count,
                  onClick: () => {
                    void onClearCourt(court.id);
                  },
                },
                {
                  key: "stop",
                  label: "Stop match",
                  danger: true,
                  disabled: !active,
                  onClick: () => onStopMatch(court.id),
                },
                {
                  key: "remove",
                  label: "Remove court",
                  danger: true,
                  disabled: disabled || active,
                  onClick: () => {
                    void onRemove(court.id);
                  },
                },
              ],
            }}
          >
            <Button
              type="text"
              aria-label={`Options for ${court.name}`}
              icon={<MoreOutlined />}
            />
          </Dropdown>
        </div>
      </div>
      <div className={styles.teams}>
        {[0, 1].map((team) => (
          <div className={styles.team} key={team}>
            <span className={styles.eyebrow}>TEAM {team + 1}</span>
            {[0, 1].map((slot) => {
              const id = court.players[team * 2 + slot];
              const p = players.find((p) => p.id === id);
              return (
                <div className={styles.courtPlayer} key={slot}>
                  {p ? (
                    <>
                      <span className={styles.playerInitial}>
                        {p.name.charAt(0).toUpperCase()}
                      </span>
                      <div className={styles.playerIdentity}>
                        <strong title={p.name}>{p.name}</strong>
                        <small>{p.level}</small>
                      </div>
                      {!active && (
                        <Button
                          type="text"
                          disabled={disabled}
                          aria-label={`Remove ${p.name} from ${court.name}`}
                          icon={<CloseOutlined />}
                          onClick={() => {
                            void onTogglePlayer(court.id, p.id);
                          }}
                        />
                      )}
                    </>
                  ) : (
                    <button
                      className={styles.emptySlot}
                      disabled={disabled}
                      onClick={() => onAssignPlayers(court.id)}
                    >
                      + Add player
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className={styles.courtFooter}>
        <span className={active ? styles.timer : styles.muted}>
          {active
            ? formatMatchTime(
                Math.max(
                  0,
                  Math.floor(
                    (currentTime - (court.startTime ?? currentTime)) / 1000,
                  ),
                ),
              )
            : ready
              ? (odds?.text ?? "Four players ready")
              : `${count}/4 assigned`}
        </span>
        {active ? (
          <Button
            type="primary"
            icon={<CheckOutlined aria-hidden="true" />}
            onClick={() => onFinishMatch(court.id)}
          >
            Finish Match
          </Button>
        ) : ready ? (
          <Button
            color="orange"
            variant="solid"
            disabled={disabled || sessionStartTime === null}
            icon={<CaretRightFilled aria-hidden="true" />}
            onClick={() => {
              void onStartMatch(court.id);
            }}
          >
            {sessionStartTime === null ? "Start session first" : "Start Match"}
          </Button>
        ) : (
          <Button disabled={disabled} onClick={() => onAssignPlayers(court.id)}>
            Assign Players
          </Button>
        )}
      </div>
      <Modal
        title="Rename court"
        open={renaming}
        onCancel={() => setRenaming(false)}
        onOk={async () => {
          if ((await onUpdateName(court.id, name)).ok) setRenaming(false);
        }}
      >
        <Input
          aria-label="Court name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Modal>
    </article>
  );
}

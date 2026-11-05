import React, { useState } from "react";
import { Alert, Modal, Select } from "antd";
import { Court, Player, QueueItem } from "../../types";
import { ActionResult } from "../../state/model";
import { TeamSlots } from "../../state/transitions";
import { canQueuePlayer, isWaitingPlayer } from "../../utils";
import styles from "../../QueuingClient.module.css";

interface Props {
  title: string;
  original: TeamSlots;
  active: boolean;
  queued?: boolean;
  players: Player[];
  courts: Court[];
  queue: QueueItem[];
  disabled: boolean;
  onCancel: () => void;
  onSave: (players: TeamSlots) => Promise<ActionResult>;
}

export default function ChangeTeamsModal(p: Props) {
  const [draft, setDraft] = useState<TeamSlots>([...p.original]);
  const [selected, setSelected] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const replacements = p.players.filter((player) =>
    !draft.includes(player.id) &&
    (p.original.includes(player.id) || (p.queued ? canQueuePlayer(player, p.courts, p.queue) : isWaitingPlayer(player, p.courts, p.queue))),
  );
  const changed = draft.some((id, i) => id !== p.original[i]);
  const choose = (index: number) => {
    if (selected === index) setSelected(null);
    else if (selected === null) {
      if (draft[index]) setSelected(index);
    } else {
      const next: TeamSlots = [...draft];
      [next[selected], next[index]] = [next[index], next[selected]];
      setDraft(next);
      setSelected(null);
    }
  };
  return (
    <Modal
      title={`Change teams — ${p.title}`}
      open
      onCancel={p.onCancel}
      closable={!pending}
      keyboard={!pending}
      maskClosable={!pending}
      cancelButtonProps={{ disabled: pending }}
      okText="Save changes"
      confirmLoading={pending}
      okButtonProps={{ disabled: p.disabled || pending || !changed }}
      onOk={async () => {
        if (pending || p.disabled || !changed) return;
        setPending(true);
        setError(null);
        try {
          const result = await p.onSave(draft);
          if (result.ok) p.onCancel();
          else setError(result.error);
        } finally {
          setPending(false);
        }
      }}
    >
      {p.active && <Alert type="info" showIcon title="This corrects the teams for this game. The timer will keep running." />}
      <p>Select a player, then another player to swap, an empty slot to move, or an eligible player below to replace them.</p>
      <div className={styles.teamEditor}>
        {[0, 1].map((team) => (
          <div key={team} role="group" aria-label={`Team ${team + 1}`}>
            <h3>Team {team + 1}</h3>
            {[0, 1].map((slot) => {
              const index = team * 2 + slot;
              const player = p.players.find((player) => player.id === draft[index]);
              return (
                <button
                  key={slot}
                  type="button"
                  className={styles.teamEditorSlot}
                  aria-label={`Team ${team + 1}, slot ${slot + 1}: ${player?.name ?? "Empty"}`}
                  aria-pressed={selected === index}
                  disabled={pending || p.disabled}
                  onClick={() => choose(index)}
                >
                  <strong>{player?.name ?? "Empty slot"}</strong>
                  {player && <small>{player.level}</small>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <p role="status" aria-live="polite">
        {selected === null ? "Select a player to rearrange teams." : `${p.players.find((player) => player.id === draft[selected])?.name} selected. Choose a destination.`}
      </p>
      <label htmlFor="replacement-player">Replace selected player</label>
      <Select
        id="replacement-player"
        aria-label="Replace selected player"
        style={{ width: "100%", marginTop: 8 }}
        showSearch
        optionFilterProp="label"
        value={null}
        placeholder={selected === null ? "Select a player above first" : "Search eligible players"}
        disabled={selected === null || pending || p.disabled}
        notFoundContent="No eligible players"
        options={replacements.map((player) => ({ value: player.id, label: `${player.name} · ${player.level}` }))}
        onChange={(id: string) => {
          if (selected === null || !replacements.some((player) => player.id === id)) return;
          const next: TeamSlots = [...draft];
          next[selected] = id;
          setDraft(next);
          setSelected(null);
        }}
      />
      <p>{p.queued ? "Checked-in, active players can be booked while playing. Each player can have one upcoming match. Players staged on an idle court are unavailable." : "Only checked-in, active players without a court or queue assignment are eligible. Replaced players keep any upcoming booking when you save."}</p>
      {error && <Alert type="error" showIcon title={error} />}
    </Modal>
  );
}

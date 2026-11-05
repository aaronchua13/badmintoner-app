import React, { useState } from "react";
import { Modal, Tag, Typography, Button, Space, Alert } from "antd";
import { Player, QueueItem, Court } from "../../types";
import { canQueuePlayer } from "../../utils";
import LevelTag from "../LevelTag";
import { ActionResult } from "../../state/model";
import styles from "./AssignToQueueModal.module.css";

const { Title, Text } = Typography;

interface AssignToQueueModalProps {
  visible: boolean;
  onCancel: () => void;
  onAfterClose?: () => void;
  playerId: string | null;
  players: Player[];
  courts: Court[];
  queue: QueueItem[];
  onCreateQueue: () => Promise<ActionResult>;
  onAddPlayerToQueue: (
    queueId: string,
    playerId: string,
  ) => Promise<ActionResult>;
}

const AssignToQueueModal: React.FC<AssignToQueueModalProps> = ({
  visible,
  onCancel,
  onAfterClose,
  playerId,
  players,
  courts,
  queue,
  onCreateQueue,
  onAddPlayerToQueue,
}) => {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const player = players.find((p) => p.id === playerId);
  const groupCount = (g: QueueItem) => g.team1.length + g.team2.length;

  const eligible = !!player && canQueuePlayer(player, courts, queue);
  const selectedGroup = queue.find((q) => q.id === selectedGroupId);
  const canAdd = eligible && !!selectedGroup && groupCount(selectedGroup) < 4;

  return (
    <Modal
      title="Assign to Queue"
      open={visible}
      onCancel={onCancel}
      afterClose={() => {
        setSelectedGroupId(null);
        onAfterClose?.();
      }}
      footer={
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <Button
            onClick={async () => {
              const result = await onCreateQueue();
              if (result.ok && result.id) setSelectedGroupId(result.id);
            }}
          >
            Create Queue
          </Button>
          <div style={{ display: "flex", gap: 8 }}>
            <Button onClick={onCancel}>Cancel</Button>
            <Button
              type="primary"
              disabled={!canAdd}
              onClick={async () => {
                if (!canAdd || !selectedGroupId || !playerId) return;
                const result = await onAddPlayerToQueue(
                  selectedGroupId,
                  playerId,
                );
                if (result.ok) onCancel();
              }}
            >
              Add to Queue
            </Button>
          </div>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {player?.isPlaying && (
          <Alert
            title="Advance booking: this match will wait until the player finishes their current game."
            type="info"
            showIcon
          />
        )}
        <Title level={5} style={{ margin: 0, fontSize: 14 }}>
          Select Queue
        </Title>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            maxHeight: "45dvh",
            overflowY: "auto",
          }}
        >
          {queue.length === 0 ? (
            <Text type="secondary">
              No queues yet. Click Create Queue to start.
            </Text>
          ) : (
            queue.map((g, index) => {
              const count = groupCount(g);
              const isFull = count >= 4;
              const isSelected = selectedGroupId === g.id;

              return (
                <div
                  key={g.id}
                  role="button"
                  tabIndex={isFull ? -1 : 0}
                  aria-pressed={isSelected}
                  aria-disabled={isFull}
                  onKeyDown={(e) => {
                    if (!isFull && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      setSelectedGroupId(g.id);
                    }
                  }}
                  onClick={() => !isFull && setSelectedGroupId(g.id)}
                  className={styles.queueOption}
                  data-selected={isSelected}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text strong>Queue {index + 1}</Text>
                    <Tag color={isFull ? "red" : "green"}>{count}/4</Tag>
                  </div>
                  <div className={styles.teams}>
                    {[g.team1, g.team2].map((team, teamIndex) => (
                      <div key={teamIndex} className={styles.team}>
                        <Text type="secondary">T{teamIndex + 1}</Text>
                        <span>
                          {team.length ? team.map((id, memberIndex) => {
                            const member = players.find((p) => p.id === id);
                            return (
                              <React.Fragment key={id}>
                                {memberIndex > 0 && ", "}
                                <span title={member?.level}>{member?.name ?? "Unknown player"}</span>
                              </React.Fragment>
                            );
                          }) : <Text type="secondary">Empty</Text>}
                          {team.length < 2 && team.length > 0 && (
                            <Text type="secondary"> · {2 - team.length} open</Text>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {player && (
          <div>
            <Text>Player: </Text>
            <Space>
              <LevelTag level={player.level} />
              <Text strong>{player.name}</Text>
            </Space>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default AssignToQueueModal;

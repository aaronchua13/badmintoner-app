import React, { useState } from "react";
import { Modal, Tag, Typography, Button, Space, Alert } from "antd";
import { Player, QueueItem, Court, isCheckedIn } from "../../types";
import LevelTag from "../LevelTag";
import { ActionResult } from "../../state/model";

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

  const isPlayerOnCourt = playerId
    ? courts.some((c) => c.players.includes(playerId))
    : false;

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
              disabled={
                !selectedGroupId ||
                !playerId ||
                isPlayerOnCourt ||
                !player ||
                !isCheckedIn(player) ||
                !player.isActive
              }
              onClick={async () => {
                if (
                  !selectedGroupId ||
                  !playerId ||
                  isPlayerOnCourt ||
                  !player ||
                  !isCheckedIn(player) ||
                  !player.isActive
                )
                  return;
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
        {isPlayerOnCourt && (
          <Alert
            message="This player is currently assigned to a court."
            type="warning"
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
            gap: 8,
            maxHeight: "60vh",
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
                  style={{
                    border: isSelected
                      ? "1px solid #047857"
                      : "1px solid #d9d9d9",
                    background: isSelected
                      ? "var(--ant-color-primary-bg)"
                      : "var(--ant-color-bg-container)",
                    borderRadius: 6,
                    padding: 12,
                    cursor: isFull ? "not-allowed" : "pointer",
                    opacity: isFull ? 0.6 : 1,
                    transition: "all 0.2s",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
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
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                    }}
                  >
                    {[g.team1, g.team2].map((team, teamIndex) => (
                      <div key={teamIndex}>
                        <Text strong>Team {teamIndex + 1}</Text>
                        {[0, 1].map((slot) => {
                          const member = players.find(
                            (p) => p.id === team[slot],
                          );
                          return (
                            <div key={slot} style={{ padding: "6px 0" }}>
                              {member ? (
                                <>
                                  <Text>{member.name}</Text>
                                  <br />
                                  <Text type="secondary">{member.level}</Text>
                                </>
                              ) : (
                                <Text type="secondary">Available slot</Text>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {player && (
          <div style={{ marginTop: 12 }}>
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

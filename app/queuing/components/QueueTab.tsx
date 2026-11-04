import React from "react";
import { Button, Dropdown, Tag } from "antd";
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  DragOutlined,
  MoreOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Court, Player, QueueItem } from "../types";
import { ActionResult } from "../state/model";
import styles from "../QueuingClient.module.css";
interface Props {
  queue: QueueItem[];
  minimized?: boolean;
  players: Player[];
  courts: Court[];
  disabled: boolean;
  onAssignToCourt: (queue: string, court: string) => Promise<ActionResult>;
  onRemoveQueueItem: (id: string) => Promise<ActionResult>;
  onMoveQueueItem: (from: number, to: number) => Promise<ActionResult>;
  onRemovePlayerFromQueue: (
    queue: string,
    player: string,
  ) => Promise<ActionResult>;
  onRemovePlayersFromQueue: (id: string) => Promise<ActionResult>;
  onAddPlayers: () => void;
}
function QueueRow({
  item,
  index,
  ...p
}: Props & { item: QueueItem; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id, disabled: p.disabled });
  const count = item.team1.length + item.team2.length;
  const courts = p.courts.filter(
    (c) => c.status === "idle" && c.players.every((id) => id === null),
  );
  return (
    <article
      className={styles.queueRow}
      aria-label={`Queued match ${index + 1}`}
      data-next-match={index === 0}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div className={styles.cardHeading}>
        <div className={styles.inline}>
          <Button
            type="text"
            {...attributes}
            {...listeners}
            aria-label={`Drag match ${index + 1}`}
            icon={<DragOutlined />}
            style={{ touchAction: "none" }}
            disabled={p.disabled}
          />
          <strong>Match {String(index + 1).padStart(2, "0")}</strong>
          {index === 0 && <Tag color="green">Next</Tag>}
          <Tag color={count === 4 ? "green" : "default"}>
            {count === 4 ? "Ready" : `${count}/4 players`}
          </Tag>
        </div>
        <Dropdown
          trigger={["click"]}
          menu={{
            items: [
              {
                key: "clear",
                label: "Clear players",
                disabled: p.disabled,
                onClick: () => {
                  void p.onRemovePlayersFromQueue(item.id);
                },
              },
              {
                key: "remove",
                label: "Remove match",
                danger: true,
                disabled: p.disabled,
                onClick: () => {
                  void p.onRemoveQueueItem(item.id);
                },
              },
            ],
          }}
        >
          <Button
            type="text"
            icon={<MoreOutlined />}
            aria-label={`Options for match ${index + 1}`}
          />
        </Dropdown>
      </div>
      <div className={styles.queueTeams}>
        {[item.team1, item.team2].map((team, i) => (
          <div key={i}>
            <small className={styles.eyebrow}>TEAM {i + 1}</small>
            {team.map((id) => (
              <div key={id} className={styles.queuePlayer}>
                <span>
                  <span>{p.players.find((p) => p.id === id)?.name}</span>
                  <small className={styles.queueLevel}>
                    {p.players.find((p) => p.id === id)?.level}
                  </small>
                </span>
                <Button
                  type="text"
                  disabled={p.disabled}
                  aria-label={`Remove ${p.players.find((p) => p.id === id)?.name} from match ${index + 1}`}
                  icon={<CloseOutlined />}
                  onClick={() => {
                    void p.onRemovePlayerFromQueue(item.id, id);
                  }}
                />
              </div>
            ))}
            {team.length < 2 && (
              <Button
                type="text"
                disabled={p.disabled}
                onClick={p.onAddPlayers}
              >
                + Add players
              </Button>
            )}
          </div>
        ))}
      </div>
      <div className={styles.courtFooter}>
        <div className={styles.inline}>
          <Button
            aria-label={`Move match ${index + 1} up`}
            disabled={p.disabled || index === 0}
            icon={<ArrowUpOutlined />}
            onClick={() => {
              void p.onMoveQueueItem(index, index - 1);
            }}
          />
          <Button
            aria-label={`Move match ${index + 1} down`}
            disabled={p.disabled || index === p.queue.length - 1}
            icon={<ArrowDownOutlined />}
            onClick={() => {
              void p.onMoveQueueItem(index, index + 1);
            }}
          />
        </div>
        <Dropdown
          trigger={["click"]}
          menu={{
            items: courts.map((c) => ({
              key: c.id,
              label: c.name,
              onClick: () => {
                void p.onAssignToCourt(item.id, c.id);
              },
            })),
          }}
        >
          <Button
            type={index === 0 ? "primary" : "default"}
            disabled={p.disabled || !count || !courts.length}
          >
            {courts.length ? "Assign to court" : "No empty court"}
          </Button>
        </Dropdown>
      </div>
    </article>
  );
}
export default function QueueTab(p: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  if (!p.queue.length) return null;
  const visibleQueue = p.minimized ? p.queue.slice(0, 1) : p.queue;
  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={({ active, over }) => {
          if (over && active.id !== over.id)
            void p.onMoveQueueItem(
              p.queue.findIndex((q) => q.id === active.id),
              p.queue.findIndex((q) => q.id === over.id),
            );
        }}
      >
        <SortableContext
          items={visibleQueue.map((q) => q.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className={styles.queueList}>
            {visibleQueue.map((item, index) => (
              <QueueRow {...p} key={item.id} item={item} index={index} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </>
  );
}

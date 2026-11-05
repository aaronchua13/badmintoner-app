import React, { useState, useRef, useMemo } from "react";
import { Button, Input, Select, Segmented, Popover, Modal, Form } from "antd";
import {
  SearchOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
} from "@ant-design/icons";
import type { InputRef } from "antd";
import {
  Court,
  Player,
  PlayerLevel,
  QueueItem,
  LEVEL_VALUE,
  isCheckedIn,
} from "../types";
import { ActionResult } from "../state/model";
import { isWaitingPlayer } from "../utils";
import { usePlayerFilters } from "../hooks/usePlayerFilters";
import PlayerList from "./PlayerList";
import AssignToQueueModal from "./modals/AssignToQueueModal";
import styles from "../QueuingClient.module.css";
interface Props {
  paymentTags?: Record<string, React.ReactNode>;
  header: React.ReactNode;
  players: Player[];
  courts: Court[];
  queue: QueueItem[];
  sessionStartTime: number | null;
  frozenTime: number | null;
  disabled: boolean;
  onToggleSelection: (court: string, player: string) => Promise<ActionResult>;
  onRenamePlayer: (id: string, name: string) => Promise<ActionResult>;
  onViewPlayer: (id: string) => void;
  onRemovePlayer: (id: string) => Promise<ActionResult>;
  onToggleActive: (id: string) => Promise<ActionResult>;
  onCheckIn: (id: string) => Promise<ActionResult>;
  onUndoCheckIn: (id: string) => Promise<ActionResult>;
  onCreateQueue: () => Promise<ActionResult>;
  onAddPlayerToQueue: (queue: string, player: string) => Promise<ActionResult>;
}
export default function PlayerPanel(p: Props) {
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameForm] = Form.useForm<{ name: string }>();
  const { clockRef, ...f } = usePlayerFilters(p.players, p.sessionStartTime, p.frozenTime);
  const focusSearchAfterClose = useRef(false);
  const searchRef = useRef<InputRef>(null);
  const [status, setStatus] = useState("All");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [assignId, setAssignId] = useState<string | null>(null);
  const filtered = useMemo(() => f.allPlayers.filter((player) => {
    const present = isCheckedIn(player);
    if (status === "Present") return present;
    if (status === "Not arrived") return !present;
    if (status === "Playing") return player.isPlaying;
    if (status === "Away") return present && !player.isActive;
    if (status === "Waiting")
      return isWaitingPlayer(player, p.courts, p.queue);
    return true;
  }), [f.allPlayers, status, p.courts, p.queue]);
  return (
    <>
      <div
        ref={clockRef}
        className={styles.rosterControls}
        data-testid="roster-floating-header"
      >
        {p.header}
        <div className={styles.rosterToolbar}>
          <Input
            ref={searchRef}
            aria-label="Search players"
            placeholder="Search players"
            prefix={<SearchOutlined />}
            allowClear
            value={f.searchQuery}
            onChange={(e) => f.setSearchQuery(e.target.value)}
          />
          <Select
            aria-label="Player status"
            value={status}
            onChange={setStatus}
            options={[
              "All",
              "Present",
              "Not arrived",
              "Waiting",
              "Playing",
              "Away",
            ].map((value) => ({
              value,
              label: value,
            }))}
          />
          <Segmented
            aria-label="Player layout"
            value={f.playerViewMode}
            onChange={f.setPlayerViewMode}
            options={[
              { label: "Rows", value: "list" },
              { label: "Cards", value: "grid" },
            ]}
          />
          <Popover
            trigger="click"
            placement="bottomRight"
            open={filtersOpen}
            onOpenChange={setFiltersOpen}
            title="Filters & sorting"
            content={
              <div className={styles.filters}>
                <Select
                  aria-label="Filter levels"
                  mode="multiple"
                  placeholder="All levels"
                  maxTagCount="responsive"
                  value={f.levelFilter}
                  allowClear
                  onChange={f.setLevelFilter}
                  options={(Object.keys(LEVEL_VALUE) as PlayerLevel[]).map(
                    (value) => ({ value, label: value }),
                  )}
                />
                <Select
                  aria-label="Filter gender"
                  value={f.genderFilter}
                  onChange={f.setGenderFilter}
                  options={["All", "Male", "Female"].map((value) => ({
                    value,
                    label: value === "All" ? "All genders" : value,
                  }))}
                />
                <Select
                  aria-label="Sort players"
                  value={f.sortConfig.field}
                  onChange={(field) =>
                    f.setSortConfig({ ...f.sortConfig, field })
                  }
                  options={[
                    ["idle_time", "Current idle"],
                    ["level", "Level"],
                    ["total_idle", "Total idle"],
                    ["games", "Games"],
                    ["wins", "Wins"],
                    ["losses", "Losses"],
                  ].map(([value, label]) => ({ value, label }))}
                />
                <Button
                  aria-label="Reverse sort order"
                  icon={
                    f.sortConfig.direction === "asc" ? (
                      <SortAscendingOutlined />
                    ) : (
                      <SortDescendingOutlined />
                    )
                  }
                  onClick={() =>
                    f.setSortConfig({
                      ...f.sortConfig,
                      direction:
                        f.sortConfig.direction === "asc" ? "desc" : "asc",
                    })
                  }
                />
              </div>
            }
          >
            <Button aria-expanded={filtersOpen}>
              Filters
              {f.levelFilter.length || f.genderFilter !== "All"
                ? " · active"
                : ""}
            </Button>
          </Popover>
        </div>
        {f.playerViewMode === "list" && (
          <div
            className={styles.rosterColumns}
            aria-hidden="true"
            data-testid="roster-column-headings"
          >
            {[
              "Name",
              "Level",
              "Current idle",
              "Total idle",
              "Games",
              "Status",
              "Actions",
            ].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        )}
      </div>
      <PlayerList
        {...p}
        onRenamePlayer={(id) => {
          renameForm.setFieldsValue({ name: p.players.find((player) => player.id === id)?.name ?? "" });
          setRenameId(id);
        }}
        sortedPlayers={filtered}
        playerViewMode={f.playerViewMode}
        onAddToQueue={setAssignId}
        onCheckIn={async (id) => {
          const result = await p.onCheckIn(id);
          if (result.ok) {
            f.setSearchQuery("");
            requestAnimationFrame(() => searchRef.current?.focus());
          }
          return result;
        }}
      />
      <Modal
        title="Rename player"
        open={!!renameId}
        onCancel={() => setRenameId(null)}
        onOk={() => renameForm.submit()}
        okText="Save name"
      >
        <Form form={renameForm} layout="vertical" onFinish={async ({ name }) => {
          if (renameId && (await p.onRenamePlayer(renameId, name.trim())).ok) setRenameId(null);
        }}>
          <Form.Item name="name" label="Player name" rules={[{ required: true, whitespace: true, message: "Enter a player name" }]}>
            <Input autoFocus maxLength={120} />
          </Form.Item>
        </Form>
      </Modal>
      <AssignToQueueModal
        visible={!!assignId}
        onCancel={() => setAssignId(null)}
        onAfterClose={() => {
          if (focusSearchAfterClose.current) {
            focusSearchAfterClose.current = false;
            requestAnimationFrame(() => searchRef.current?.focus());
          }
        }}
        playerId={assignId}
        players={p.players}
        courts={p.courts}
        queue={p.queue}
        onCreateQueue={p.onCreateQueue}
        onAddPlayerToQueue={async (queueId, playerId) => {
          const result = await p.onAddPlayerToQueue(queueId, playerId);
          if (result.ok) {
            f.setSearchQuery("");
            focusSearchAfterClose.current = true;
          }
          return result;
        }}
      />
    </>
  );
}

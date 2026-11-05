import { useConfirmation } from "../../hooks/useConfirmation";
import React, { useMemo, useState } from "react";
import {
  Modal,
  Input,
  Button,
  Select,
  Typography,
  message,
  Checkbox,
  Tooltip,
  Grid,
} from "antd";
import {
  EditOutlined,
  PlusOutlined,
  DeleteOutlined,
  CheckOutlined,
} from "@ant-design/icons";
import {
  Gender,
  PlayerLevel,
  PlayersDbEntry,
  LEVEL_COLORS,
  LEVEL_TEXT_COLORS,
} from "../../types";
import { usePlayersDatabase } from "../../hooks/usePlayersDatabase";
import styles from "./PlayersDatabaseModal.module.css";

import { useProgressiveRows } from "../../hooks/useProgressiveRows";
import { useStableEvent } from "../../hooks/useStableEvent";
import type { ActionResult } from "../../state/model";
import DeferredDialog from "./DeferredDialog";
interface PlayersDatabaseModalProps {
  visible: boolean;
  onClose: () => void;
  onAddToSession: (
    players: Array<{ name: string; gender: Gender; level: PlayerLevel }>,
  ) => Promise<boolean>;
  existingPlayers: string[];
  searchInputRef?: React.RefObject<HTMLDivElement | null>;
  addSelectedButtonRef?: React.RefObject<HTMLDivElement | null>;
}

const { Text } = Typography;

const levelOptions: { label: string; value: PlayerLevel }[] = [
  "Beginner -",
  "Beginner",
  "Beginner +",
  "Intermediate -",
  "Intermediate",
  "Intermediate +",
  "Advanced -",
  "Advanced",
  "Advanced +",
].map((l) => ({ label: l, value: l as PlayerLevel }));

interface Draft {
  search: [string, React.Dispatch<React.SetStateAction<string>>];
  selected: [React.Key[], React.Dispatch<React.SetStateAction<React.Key[]>>];
  editing: [string | null, React.Dispatch<React.SetStateAction<string | null>>];
  name: [string, React.Dispatch<React.SetStateAction<string>>];
}
const PlayersDatabaseModalContent: React.FC<PlayersDatabaseModalProps & { draft: Draft; afterClose: () => void }> = ({
  draft,
  afterClose,
  visible,
  onClose,
  onAddToSession,
  existingPlayers,
  searchInputRef,
  addSelectedButtonRef,
}) => {
  const { md } = Grid.useBreakpoint();
  const { confirm, holder: confirmationHolder } = useConfirmation();
  const db = usePlayersDatabase(draft.search);
  const [selectedRowKeys, setSelectedRowKeys] = draft.selected;
  const [editingId, setEditingId] = draft.editing;
  const [editName, setEditName] = draft.name;

  const dataSource = db.filtered;
  const renderedRows = useProgressiveRows(dataSource, visible);
  const existingNames = useMemo(() => new Set(existingPlayers.map((name) => name.toLowerCase())), [existingPlayers]);
  const selectedIds = useMemo(() => new Set(selectedRowKeys), [selectedRowKeys]);

  const startEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const trimmed = editName.trim();
    const original = dataSource.find((d) => d.id === editingId)?.name;

    if (trimmed && trimmed !== original) {
      const res = await db.updateName(editingId, trimmed);
      if (!res.ok) {
        message.error(res.error || "Duplicate name");
        // Keep editing state if error
        return;
      }
    }
    setEditingId(null);
    setEditName("");
  };

  const toggleSelection = (id: string) => {
    setSelectedRowKeys((prev) =>
      prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id],
    );
  };

  const rowEvents = {
    toggleSelection: useStableEvent(toggleSelection),
    startEdit: useStableEvent(startEdit),
    setEditName: useStableEvent(setEditName),
    saveEdit: useStableEvent(saveEdit),
    onAddToSession: useStableEvent(onAddToSession),
    updateGender: useStableEvent(db.updateGender),
    updateLevel: useStableEvent(db.updateLevel),
    remove: useStableEvent(db.remove),
    confirm: useStableEvent(confirm),
  };
  return (
    <Modal
      title="Players Database"
      open={visible}
      afterClose={afterClose}
      onCancel={onClose}
      footer={null}
      width={700}
      classNames={{ body: styles.modalBody }}
    >
      {confirmationHolder}
      <div className={styles.header}>
        <div ref={searchInputRef}>
          <Input
            aria-label="Search saved players"
            placeholder="Search..."
            value={db.searchQuery}
            onChange={(e) => db.setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        <div ref={addSelectedButtonRef}>
          <Button
            onClick={async () => {
              if (selectedRowKeys.length === 0) {
                message.warning("Select players first");
                return;
              }
              const selectedPlayers = dataSource
                .filter((e) => selectedRowKeys.includes(e.id))
                .map((e) => ({
                  name: e.name,
                  gender: e.gender,
                  level: e.level,
                }));
              if (await onAddToSession(selectedPlayers)) setSelectedRowKeys([]); // Clear selection after adding
            }}
            type="primary"
          >
            Add Selected
          </Button>
        </div>
        <Button onClick={() => db.refresh()}>Refresh</Button>
      </div>

      <div className={styles.listContainer}>
        {dataSource.length > 0 ? (
          <div className={styles.listWrapper}>
            {renderedRows.map((entry) => <DatabaseRow key={entry.id} entry={entry}
              isAdded={existingNames.has(entry.name.toLowerCase())} isSelected={selectedIds.has(entry.id)}
              isEditing={editingId === entry.id} editName={editingId === entry.id ? editName : ""} md={!!md}
              {...rowEvents} />)}
          </div>
        ) : (
          <div className={styles.emptyState}>No players found</div>
        )}
      </div>
    </Modal>
  );
};

export function PlayersDatabaseModal(p: PlayersDatabaseModalProps) {
  const draft: Draft = {
    search: useState(""), selected: useState<React.Key[]>([]),
    editing: useState<string | null>(null), name: useState(""),
  };
  return <DeferredDialog open={p.visible}>{(visible, afterClose) => <PlayersDatabaseModalContent {...p} visible={visible} afterClose={afterClose} draft={draft} />}</DeferredDialog>;
}
export default PlayersDatabaseModal;

PlayersDatabaseModalContent.displayName = "PlayersDatabaseModalContent";

interface DatabaseRowProps {
  entry: PlayersDbEntry; isAdded: boolean; isSelected: boolean; isEditing: boolean; editName: string; md: boolean;
  toggleSelection: (id: string) => void; startEdit: (id: string, name: string) => void;
  setEditName: (name: string) => void; saveEdit: () => Promise<void>;
  onAddToSession: PlayersDatabaseModalProps["onAddToSession"];
  updateGender: (id: string, gender: Gender) => Promise<ActionResult>;
  updateLevel: (id: string, level: PlayerLevel) => Promise<ActionResult>;
  remove: (id: string) => Promise<ActionResult>;
  confirm: ReturnType<typeof useConfirmation>["confirm"];
}
const DatabaseRow = React.memo(function DatabaseRow(p: DatabaseRowProps) {
  const { entry, isAdded, isSelected, isEditing, editName, md, toggleSelection, startEdit, setEditName, saveEdit, onAddToSession, updateGender, updateLevel, remove, confirm } = p;
  // Component fragments for responsive layout
  const CheckboxNode = (
    <Checkbox
      checked={isSelected}
      disabled={isAdded}
      onChange={() => toggleSelection(entry.id)}
      className={styles.checkbox}
    />
  );

  const NameNode = (
    <div className={styles.nameWrapper}>
      {isEditing ? (
        <Input
          size="small"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={saveEdit}
          onPressEnter={saveEdit}
          autoFocus
          className={styles.editInput}
        />
      ) : (
        <div
          className={styles.nameDisplay}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter") startEdit(entry.id, entry.name);
          }}
          onClick={() => startEdit(entry.id, entry.name)}
        >
          <Text
            className={styles.nameText}
            ellipsis={{ tooltip: entry.name }}
          >
            {entry.name}
          </Text>
          <EditOutlined className={styles.editIcon} />
        </div>
      )}
    </div>
  );

  const GenderNode = (
    <Select
      aria-label={`Gender for ${entry.name}`}
      size="small"
      value={entry.gender}
      className={styles.genderSelect}
      onChange={async (g: Gender) => {
        const result = await updateGender(entry.id, g);
        if (!result.ok && result.error !== "Cancelled")
          message.error(result.error);
      }}
      options={[
        { label: "M", value: "Male" },
        { label: "F", value: "Female" },
      ]}
      variant="borderless"
    />
  );

  const LevelNode = (
    <Select
      aria-label={`Level for ${entry.name}`}
      size="small"
      value={entry.level}
      className={styles.levelSelect}
      onChange={async (l: PlayerLevel) => {
        const result = await updateLevel(entry.id, l);
        if (!result.ok && result.error !== "Cancelled")
          message.error(result.error);
      }}
      options={levelOptions}
      optionRender={(option) => {
        const lvl = option.value as PlayerLevel;
        return (
          <div className={styles.levelOption}>
            <span
              className={styles.levelBadge}
              style={{
                background: LEVEL_COLORS[lvl],
                color: LEVEL_TEXT_COLORS[lvl],
              }}
            >
              {option.label}
            </span>
          </div>
        );
      }}
      labelRender={(props) => {
        const lvl = props.value as PlayerLevel;
        return (
          <span
            className={styles.levelBadge}
            style={{
              background: LEVEL_COLORS[lvl],
              color: LEVEL_TEXT_COLORS[lvl],
            }}
          >
            {props.label}
          </span>
        );
      }}
      variant="filled"
    />
  );

  const ActionsNode = (
    <div className={styles.actionsWrapper}>
      <Tooltip title={isAdded ? "Already Added" : "Add to Session"}>
        <Button
          size="small"
          aria-label={`Add ${entry.name} to session`}
          type={isAdded ? "default" : "primary"}
          icon={isAdded ? <CheckOutlined /> : <PlusOutlined />}
          disabled={isAdded}
          onClick={() => {
            onAddToSession([
              {
                name: entry.name,
                gender: entry.gender,
                level: entry.level,
              },
            ]);
          }}
          className={styles.actionButton}
        />
      </Tooltip>
      <Tooltip title="Delete from DB">
        <Button
          size="small"
          danger
          icon={<DeleteOutlined />}
          aria-label={`Delete ${entry.name} from database`}
          onClick={async () => {
            const result = await confirm(
              `Delete ${entry.name} from the player database?`,
              "This deletes the reusable player entry. Players already in the current session and match history are kept.",
              "Delete player",
              () => remove(entry.id),
            );
            if (!result.ok && result.error !== "Cancelled")
              message.error(result.error);
          }}
          className={styles.actionButton}
        />
      </Tooltip>
    </div>
  );

  return (
    <div key={entry.id} className={styles.listItem}>
      {md ? (
        // Desktop Layout: Single Row
        <div className={styles.desktopRow}>
          {CheckboxNode}
          <div className={styles.desktopNameContainer}>
            {NameNode}
          </div>
          <div className={styles.desktopMetaContainer}>
            {GenderNode}
            {LevelNode}
            {ActionsNode}
          </div>
        </div>
      ) : (
        // Mobile Layout: Two Rows
        <div className={styles.mobileWrapper}>
          <div className={styles.mobileTopRow}>
            {CheckboxNode}
            {NameNode}
            {ActionsNode}
          </div>
          <div className={styles.mobileBottomRow}>
            {GenderNode}
            {LevelNode}
          </div>
        </div>
      )}
    </div>
  );
});

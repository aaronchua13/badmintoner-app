import { useConfirmation } from "../../hooks/useConfirmation";
import React, { useMemo, useState, useEffect } from "react";
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
  LEVEL_COLORS,
  LEVEL_TEXT_COLORS,
} from "../../types";
import { usePlayersDatabase } from "../../hooks/usePlayersDatabase";
import styles from "./PlayersDatabaseModal.module.css";

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

export const PlayersDatabaseModal: React.FC<PlayersDatabaseModalProps> = ({
  visible,
  onClose,
  onAddToSession,
  existingPlayers,
  searchInputRef,
  addSelectedButtonRef,
}) => {
  const { md } = Grid.useBreakpoint();
  const { confirm, holder: confirmationHolder } = useConfirmation();
  const db = usePlayersDatabase();
  const { refresh } = db;
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  // Auto-refresh when modal is opened
  useEffect(() => {
    if (visible) {
      void refresh();
    }
  }, [visible, refresh]);

  const dataSource = useMemo(() => db.filtered, [db.filtered]);

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

  return (
    <Modal
      title="Players Database"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={700}
      classNames={{ body: styles.modalBody }}
    >
      {confirmationHolder}
      <div className={styles.header}>
        <div ref={searchInputRef}>
          <Input
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
            {dataSource.map((entry) => {
              const isAdded = existingPlayers.some(
                (name) => name.toLowerCase() === entry.name.toLowerCase(),
              );
              const isSelected = selectedRowKeys.includes(entry.id);
              const isEditing = editingId === entry.id;

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
                    const result = await db.updateGender(entry.id, g);
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
                    const result = await db.updateLevel(entry.id, l);
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
                          () => db.remove(entry.id),
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
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>No players found</div>
        )}
      </div>
    </Modal>
  );
};

export default PlayersDatabaseModal;

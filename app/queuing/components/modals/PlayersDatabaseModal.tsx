import React, { useMemo, useState, useEffect } from 'react';
import { Modal, Input, Button, Select, Typography, message, Checkbox, Tooltip, Grid } from 'antd';
import { EditOutlined, PlusOutlined, DeleteOutlined, CheckOutlined } from '@ant-design/icons';
import { Gender, PlayerLevel, LEVEL_COLORS, LEVEL_TEXT_COLORS } from '../../types';
import { usePlayersDatabase } from '../../hooks/usePlayersDatabase';
import styles from './PlayersDatabaseModal.module.css';

interface PlayersDatabaseModalProps {
  visible: boolean;
  onClose: () => void;
  onAddToSession: (players: Array<{ name: string; gender: Gender; level: PlayerLevel }>) => void;
  existingPlayers: string[];
}

const { Text } = Typography;

const levelOptions: { label: string; value: PlayerLevel }[] = [
  'Beginner -', 'Beginner', 'Beginner +',
  'Intermediate -', 'Intermediate', 'Intermediate +',
  'Advanced -', 'Advanced', 'Advanced +'
].map(l => ({ label: l, value: l as PlayerLevel }));

export const PlayersDatabaseModal: React.FC<PlayersDatabaseModalProps> = ({
  visible,
  onClose,
  onAddToSession,
  existingPlayers
}) => {
  const { md } = Grid.useBreakpoint();
  const db = usePlayersDatabase();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Auto-refresh when modal is opened
  useEffect(() => {
    if (visible) {
      db.refresh();
    }
  }, [visible, db.refresh]);

  const dataSource = useMemo(() => db.filtered, [db.filtered]);

  const startEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const trimmed = editName.trim();
    const original = dataSource.find(d => d.id === editingId)?.name;
    
    if (trimmed && trimmed !== original) {
      const res = db.updateName(editingId, trimmed);
      if (!res.ok) {
        message.error(res.error || 'Duplicate name');
        // Keep editing state if error
        return;
      }
    }
    setEditingId(null);
    setEditName('');
  };

  const toggleSelection = (id: string) => {
    setSelectedRowKeys(prev => 
      prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id]
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
      <div className={styles.header}>
        <Input 
          placeholder="Search..."
          value={db.searchQuery}
          onChange={e => db.setSearchQuery(e.target.value)}
          className={styles.searchInput}
        />
        <Button
          onClick={() => {
            if (selectedRowKeys.length === 0) {
              message.warning('Select players first');
              return;
            }
            const selectedPlayers = dataSource
              .filter(e => selectedRowKeys.includes(e.id))
              .map(e => ({ name: e.name, gender: e.gender, level: e.level }));
            onAddToSession(selectedPlayers);
            setSelectedRowKeys([]); // Clear selection after adding
          }}
          type="primary"
        >
          Add Selected
        </Button>
        <Button onClick={() => db.refresh()}>Refresh</Button>
      </div>
      
      <div className={styles.listContainer}>
        {dataSource.length > 0 ? (
          <div className={styles.listWrapper}>
            {dataSource.map((entry, index) => {
               const isAdded = existingPlayers.some(name => name.toLowerCase() === entry.name.toLowerCase());
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
                        onChange={e => setEditName(e.target.value)}
                        onBlur={saveEdit}
                        onPressEnter={saveEdit}
                        autoFocus
                        className={styles.editInput}
                      />
                    ) : (
                      <div 
                        className={styles.nameDisplay}
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
                    size="small"
                    value={entry.gender}
                    className={styles.genderSelect}
                    onChange={(g: Gender) => db.updateGender(entry.id, g)}
                    options={[{ label: 'M', value: 'Male' }, { label: 'F', value: 'Female' }]}
                    variant="borderless"
                  />
               );

               const LevelNode = (
                  <Select
                    size="small"
                    value={entry.level}
                    className={styles.levelSelect}
                    onChange={(l: PlayerLevel) => db.updateLevel(entry.id, l)}
                    options={levelOptions}
                    optionRender={(option) => {
                        const lvl = option.value as PlayerLevel;
                        return (
                          <div className={styles.levelOption}>
                            <span 
                              className={styles.levelBadge}
                              style={{ background: LEVEL_COLORS[lvl], color: LEVEL_TEXT_COLORS[lvl] }}
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
                            style={{ background: LEVEL_COLORS[lvl], color: LEVEL_TEXT_COLORS[lvl] }}
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
                        type={isAdded ? 'default' : 'primary'}
                        icon={isAdded ? <CheckOutlined /> : <PlusOutlined />}
                        disabled={isAdded}
                        onClick={() => {
                            onAddToSession([{ name: entry.name, gender: entry.gender, level: entry.level }]);
                        }}
                        className={styles.actionButton}
                      />
                    </Tooltip>
                    <Tooltip title="Delete from DB">
                      <Button 
                        size="small" 
                        danger 
                        icon={<DeleteOutlined />} 
                        onClick={() => db.remove(entry.id)}
                        className={styles.actionButton}
                      />
                    </Tooltip>
                 </div>
               );
               
               return (
                 <div 
                    key={entry.id} 
                    className={styles.listItem}
                 >
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

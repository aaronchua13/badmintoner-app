import React from 'react';
import { Card, Typography, Tag, Button, Radio, Tooltip } from 'antd';
import { DeleteOutlined, DragOutlined, CloseOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { Player, Court, QueueItem } from '../types';
import LevelTag from './LevelTag';
import { DndContext, closestCenter, useSensor, useSensors, TouchSensor, MouseSensor } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const { Title } = Typography;

interface QueueTabProps {
  queue: QueueItem[];
  players: Player[];
  courts: Court[];
  autoAssignQueue: boolean;
  onSetAutoAssign: (enabled: boolean) => void;
  onAssignToCourt: (queueId: string, courtId: string) => void;
  onRemoveQueueItem: (id: string) => void;
  onMoveQueueItem: (fromIndex: number, toIndex: number) => void;
  onRemovePlayerFromQueue?: (queueId: string, playerId: string) => void;
  onRemovePlayersFromQueue?: (queueId: string) => void;
}

const TeamPlayersList: React.FC<{
  label: string;
  tagColor: string;
  list: Player[];
  onRemove?: (id: string) => void;
  emptyText?: string;
  pillBg: string;
  pillBorder: string;
}> = ({ label, tagColor, list, onRemove, emptyText = 'Empty', pillBg, pillBorder }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
    <Tag color={tagColor} style={{ margin: 0, fontSize: 10, lineHeight: '16px', height: 18, padding: '0 3px' }}>{label}</Tag>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, flex: 1 }}>
      {list.length === 0 && <span style={{ fontSize: 10, color: '#d9d9d9', fontStyle: 'italic', lineHeight: '18px' }}>{emptyText}</span>}
      {list.map(p => (
        <div key={p.id} style={{
          display: 'flex',
          alignItems: 'center',
          background: pillBg,
          border: `1px solid ${pillBorder}`,
          borderRadius: 4,
          padding: '1px 4px',
          height: 18
        }}>
          <LevelTag level={p.level} style={{ transform: 'scale(0.75)', margin: 0 }} />
          <span style={{ fontSize: 10, marginLeft: 3, maxWidth: 80, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
          {onRemove && (
            <div
              onClick={() => onRemove(p.id)}
              style={{ marginLeft: 4, cursor: 'pointer', color: '#999', fontSize: 9, display: 'flex', alignItems: 'center' }}
            >
              <CloseOutlined />
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
);

const QueueRow: React.FC<{
  item: QueueItem;
  players: Player[];
  courts: Court[];
  onAssign: (courtId: string) => void;
  onRemove: () => void;
  id: string;
  onRemovePlayer?: (playerId: string) => void;
  onRemovePlayers?: () => void;
}> = ({ item, players, courts, onAssign, onRemove, id, onRemovePlayer, onRemovePlayers }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: '#fff',
    border: '1px solid #f0f0f0',
    borderRadius: 6,
    padding: 6,
    display: 'flex',
    flexDirection: 'column', // Changed to column for mobile
    gap: 4,
    position: 'relative', // For absolute positioning if needed
    zIndex: isDragging ? 1000 : 'auto'
  };
  const team1 = item.team1.map(pid => players.find(p => p.id === pid)).filter(Boolean) as Player[];
  const team2 = item.team2.map(pid => players.find(p => p.id === pid)).filter(Boolean) as Player[];
  const idleCourts = courts.filter(c => c.status === 'idle');
  const canAssign = (item: QueueItem) => (item.team1.length + item.team2.length) > 0;
  
  return (
    <div ref={setNodeRef} style={style}>
      {/* Header: Drag Handle + Queue ID/Title + Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Button type="text" size="small" icon={<DragOutlined />} {...attributes} {...listeners} style={{ cursor: 'grab', color: '#8c8c8c', width: 20, height: 20, minWidth: 20, touchAction: 'none' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: '#595959' }}>Queue Item</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {onRemovePlayers && (
             <Button size="small" onClick={onRemovePlayers} style={{ fontSize: 10, padding: '0 4px', height: 20 }}>
               Clear
             </Button>
           )}
           <Button danger size="small" icon={<DeleteOutlined />} onClick={onRemove} style={{ width: 20, height: 20, minWidth: 20, fontSize: 11 }} />
        </div>
      </div>

      {/* Teams Container */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 0 }}>
        <TeamPlayersList
          label="T1"
          tagColor="blue"
          list={team1}
          onRemove={onRemovePlayer}
          emptyText="Empty"
          pillBg="#f0f5ff"
          pillBorder="#d6e4ff"
        />
        <TeamPlayersList
          label="T2"
          tagColor="green"
          list={team2}
          onRemove={onRemovePlayer}
          emptyText="Empty"
          pillBg="#f6ffed"
          pillBorder="#d9f7be"
        />
      </div>

      {/* Footer: Assignment Actions */}
      {idleCourts.length > 0 && canAssign(item) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingTop: 2, borderTop: '1px solid #f5f5f5', marginTop: 2 }}>
          <span style={{ fontSize: 10, color: '#888' }}>Assign to:</span>
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto' }}>
            {idleCourts.map(c => (
              <Button
                key={c.id}
                size="small"
                onClick={() => onAssign(c.id)}
                style={{ fontSize: 10, height: 20, padding: '0 6px', minWidth: 20 }}
              >
                {c.name.replace('Court ', 'C')}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const QueueTab: React.FC<QueueTabProps> = ({
  queue,
  players,
  courts,
  autoAssignQueue,
  onSetAutoAssign,
  onAssignToCourt,
  onRemoveQueueItem,
  onMoveQueueItem,
  onRemovePlayerFromQueue,
  onRemovePlayersFromQueue
}) => {
  const ids = queue.map(q => q.id);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );
  return (
    <Card styles={{ body: { padding: 8 } }} variant="borderless">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Title level={5} style={{ margin: 0, fontSize: 14 }}>Queue ({queue.length})</Title>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Radio.Group
            value={autoAssignQueue ? 'auto' : 'manual'}
            onChange={(e) => onSetAutoAssign(e.target.value === 'auto')}
            size="small"
            buttonStyle="solid"
          >
            <Radio.Button value="manual" style={{ padding: '0 8px' }}>Manual</Radio.Button>
            <Radio.Button value="auto" style={{ padding: '0 8px' }}>Auto</Radio.Button>
          </Radio.Group>
          <Tooltip title={
            <div style={{ maxWidth: 280 }}>
              <div style={{ marginBottom: 6 }}>
                <strong>Manual:</strong> You choose when a queued match goes to a court.
              </div>
              <div>
                <strong>Auto:</strong> When a game finishes or a new court is added, the system moves the first queue item that has at least one player to any empty court automatically.
              </div>
              <div style={{ marginTop: 6 }}>
                It does not auto-move just because you add players to the queue while courts are empty. Auto only reacts to matches finishing or courts being added.
              </div>
            </div>
          }>
          </Tooltip>
        </div>
      </div>
      
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(event) => {
          const { active, over } = event;
          if (!over || active.id === over.id) return;
          const from = ids.findIndex(id => id === String(active.id));
          const to = ids.findIndex(id => id === String(over.id));
          if (from !== -1 && to !== -1) onMoveQueueItem(from, to);
        }}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overscrollBehavior: 'contain' }}>
            {queue.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#999', padding: 16 }}>No queued matches</div>
            ) : (
              queue.map(item => (
                <QueueRow
                  key={item.id}
                  id={item.id}
                  item={item}
                  players={players}
                  courts={courts}
                  onAssign={(cid) => onAssignToCourt(item.id, cid)}
                  onRemove={() => onRemoveQueueItem(item.id)}
                onRemovePlayers={onRemovePlayersFromQueue ? () => onRemovePlayersFromQueue(item.id) : undefined}
                onRemovePlayer={onRemovePlayerFromQueue ? (pid) => onRemovePlayerFromQueue(item.id, pid) : undefined}
                />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>
    </Card>
  );
};

export default QueueTab;

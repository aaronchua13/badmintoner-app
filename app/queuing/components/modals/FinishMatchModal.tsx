import React from 'react';
import { Modal, Form, InputNumber, Radio, Typography, Divider } from 'antd';
import { Court, Player } from '../../types';

interface FinishMatchModalProps {
  visible: boolean;
  onCancel: () => void;
  onFinish: (values: { team1Score?: number; team2Score?: number; winningTeam?: number }) => void;
  form: any;
  court: Court | undefined;
  players: Player[];
}

const FinishMatchModal: React.FC<FinishMatchModalProps> = ({
  visible,
  onCancel,
  onFinish,
  form,
  court,
  players
}) => {
  const getTeamNames = (indices: number[]) => {
    if (!court) return '';
    return indices
      .map(i => court.players[i])
      .filter(Boolean)
      .map(pid => players.find(p => p.id === pid)?.name)
      .join(' & ');
  };

  return (
    <Modal
      title="Finish Match"
      open={visible}
      onCancel={onCancel}
      onOk={() => form.submit()}
    >
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
           <Form.Item name="team1Score" label={`Team 1 (${getTeamNames([0, 1])})`} style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
           </Form.Item>
           <div style={{ marginTop: 32 }}>-</div>
           <Form.Item name="team2Score" label={`Team 2 (${getTeamNames([2, 3])})`} style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
           </Form.Item>
        </div>
        
        <Divider plain>Who Won?</Divider>
        
        <Form.Item name="winningTeam" rules={[{ required: true, message: 'Please select a winner' }]}>
           <Radio.Group style={{ width: '100%', display: 'flex' }}>
              <Radio.Button value={1} style={{ flex: 1, textAlign: 'center' }}>Team 1</Radio.Button>
              <Radio.Button value={2} style={{ flex: 1, textAlign: 'center' }}>Team 2</Radio.Button>
           </Radio.Group>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default FinishMatchModal;

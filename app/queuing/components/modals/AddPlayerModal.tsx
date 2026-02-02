import React from 'react';
import { Modal, Form, Input, Select, Radio, Space } from 'antd';
import { PlayerLevel, LEVEL_COLORS } from '../../types';

interface AddPlayerModalProps {
  visible: boolean;
  onCancel: () => void;
  onAdd: (values: { name: string; level: PlayerLevel; gender: 'Male' | 'Female' }) => void;
  form: any; // Antd form instance
  mode: 'close' | 'keep';
  setMode: (mode: 'close' | 'keep') => void;
}

const AddPlayerModal: React.FC<AddPlayerModalProps> = ({
  visible,
  onCancel,
  onAdd,
  form,
  mode,
  setMode
}) => {
  return (
    <Modal
      title="Add New Player"
      open={visible}
      onCancel={onCancel}
      onOk={() => form.submit()}
    >
      <Form form={form} layout="vertical" onFinish={onAdd} initialValues={{ level: 'Intermediate', gender: 'Male' }}>
        <Form.Item name="name" label="Player Name" rules={[{ required: true }]}>
          <Input placeholder="Enter name" autoFocus />
        </Form.Item>
        <Form.Item name="level" label="Level" rules={[{ required: true }]}>
          <Select>
            {(Object.keys(LEVEL_COLORS) as PlayerLevel[]).map(level => (
              <Select.Option key={level} value={level}>
                <Space>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: LEVEL_COLORS[level] }} />
                  {level}
                </Space>
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="gender" label="Gender" rules={[{ required: true }]}>
           <Radio.Group buttonStyle="solid">
              <Radio.Button value="Male">Male</Radio.Button>
              <Radio.Button value="Female">Female</Radio.Button>
           </Radio.Group>
        </Form.Item>
        
        <Form.Item label="After Adding">
           <Radio.Group value={mode} onChange={e => setMode(e.target.value)}>
              <Radio value="close">Close Modal</Radio>
              <Radio value="keep">Keep Open (Add Another)</Radio>
           </Radio.Group>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddPlayerModal;

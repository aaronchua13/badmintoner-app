import React from 'react';
import { Modal, Form, Input } from 'antd';

interface StopMatchModalProps {
  visible: boolean;
  onCancel: () => void;
  onStop: (values: { reason: string }) => void;
  form: any;
}

const StopMatchModal: React.FC<StopMatchModalProps> = ({
  visible,
  onCancel,
  onStop,
  form
}) => {
  return (
    <Modal
      title="Stop Match (No Winner)"
      open={visible}
      onCancel={onCancel}
      onOk={() => form.submit()}
    >
      <Form form={form} layout="vertical" onFinish={onStop}>
        <Form.Item name="reason" label="Reason" rules={[{ required: true }]}>
          <Input placeholder="e.g. Injury, Time up" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default StopMatchModal;

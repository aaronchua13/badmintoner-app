import React from 'react';
import { Modal, Form, Input, type FormInstance } from 'antd';

interface AddCourtModalProps {
  visible: boolean;
  onCancel: () => void;
  onCreate: (values: { name: string }) => void;
  form: FormInstance;
}

const AddCourtModal: React.FC<AddCourtModalProps> = ({
  visible,
  onCancel,
  onCreate,
  form
}) => {
  return (
    <Modal
      title="Add Court"
      open={visible}
      onCancel={onCancel}
      onOk={() => form.submit()}
    >
      <Form form={form} layout="vertical" onFinish={onCreate}>
        <Form.Item name="name" label="Court Name" rules={[{ required: true }]}>
          <Input placeholder="Court name" autoFocus />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddCourtModal;

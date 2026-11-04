import { useHydrated } from '../../hooks/useHydrated';
import React from "react";
import { Modal, Form, Input, type FormInstance } from "antd";

interface AddCourtModalProps {
  visible: boolean;
  onCancel: () => void;
  onCreate: (values: { name: string }) => void;
  form: FormInstance;
  nameInputRef?: React.RefObject<HTMLDivElement | null>;
}

const AddCourtModal: React.FC<AddCourtModalProps> = ({
  visible,
  onCancel,
  onCreate,
  form,
  nameInputRef,
}) => {
  const hydrated = useHydrated();
  return (
    <Modal
      forceRender={hydrated}
      title="Add Court"
      open={visible}
      onCancel={onCancel}
      onOk={() => form.submit()}
    >
      <Form name="add-court" form={form} layout="vertical" onFinish={onCreate}>
        <div ref={nameInputRef}>
          <Form.Item
            name="name"
            label="Court Name"
            rules={[{ required: true, whitespace: true }]}
          >
            <Input placeholder="Court name" autoFocus />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
};

export default AddCourtModal;

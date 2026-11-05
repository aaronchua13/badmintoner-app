import { useHydrated } from '../../hooks/useHydrated';
import React from "react";
import {
  Modal,
  Form,
  Input,
  Select,
  Radio,
  Space,
  type FormInstance,
} from "antd";
import { PlayerLevel, LEVEL_COLORS } from "../../types";
import styles from "./AddPlayerModal.module.css";

interface AddPlayerModalProps {
  visible: boolean;
  onCancel: () => void;
  onAdd: (values: {
    name: string;
    level: PlayerLevel;
    gender: "Male" | "Female";
  }) => void;
  form: FormInstance; // Antd form instance
  mode: "close" | "keep";
  setMode: (mode: "close" | "keep") => void;
  nameInputRef?: React.RefObject<HTMLDivElement | null>;
}

const AddPlayerModal: React.FC<AddPlayerModalProps> = ({
  visible,
  onCancel,
  onAdd,
  form,
  mode,
  setMode,
  nameInputRef,
}) => {
  const hydrated = useHydrated();
  return (
    <Modal
      forceRender={hydrated}
      title="Add New Player"
      open={visible}
      onCancel={onCancel}
      onOk={() => form.submit()}
    >
      <Form
        className={styles.form}
        name="add-player"
        form={form}
        layout="vertical"
        onFinish={onAdd}
        initialValues={{ level: "Intermediate", gender: "Male" }}
      >
        <div ref={nameInputRef}>
          <Form.Item
            name="name"
            label="Player Name"
            rules={[{ required: true, whitespace: true }]}
          >
            <Input placeholder="Enter name" autoFocus />
          </Form.Item>
        </div>
        <Form.Item name="level" label="Level" rules={[{ required: true }]}>
          <Select>
            {(Object.keys(LEVEL_COLORS) as PlayerLevel[]).map((level) => (
              <Select.Option key={level} value={level}>
                <Space>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: LEVEL_COLORS[level],
                    }}
                  />
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
          <Radio.Group className={styles.afterAdding} value={mode} onChange={(e) => setMode(e.target.value)}>
            <Radio value="close">Close Modal</Radio>
            <Radio value="keep">Keep Open (Add Another)</Radio>
          </Radio.Group>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddPlayerModal;

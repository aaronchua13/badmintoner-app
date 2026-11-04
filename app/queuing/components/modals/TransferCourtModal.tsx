import { useHydrated } from '../../hooks/useHydrated';
import React from "react";
import { Modal, Select, Form, Alert } from "antd";
import { SwapOutlined } from "@ant-design/icons";
import { Court } from "../../types";
import { ActionResult } from "../../state/model";

interface TransferCourtModalProps {
  visible: boolean;
  onCancel: () => void;
  onTransfer: (targetCourtId: string) => Promise<ActionResult>;
  currentCourt: Court | undefined;
  courts: Court[];
}

const TransferCourtModal: React.FC<TransferCourtModalProps> = ({
  visible,
  onCancel,
  onTransfer,
  currentCourt,
  courts,
}) => {
  const hydrated = useHydrated();
  const [form] = Form.useForm();

  // Filter valid target courts:
  // 1. Not the current court
  // 2. Status is idle
  // 3. No players assigned (empty)
  const targetCourts = courts.filter(
    (c) =>
      c.id !== currentCourt?.id &&
      c.status === "idle" &&
      c.players.every((p) => p === null),
  );

  const handleOk = () => {
    form
      .validateFields()
      .then(async (values) => {
        if ((await onTransfer(values.targetCourtId)).ok) form.resetFields();
      })
      .catch(() => {
        /* Field errors remain visible in the form. */
      });
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      forceRender={hydrated}
      title="Transfer Match/Players"
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      okText="Transfer"
      okButtonProps={{
        icon: <SwapOutlined />,
        disabled: targetCourts.length === 0,
      }}
    >
      <div style={{ marginBottom: 16 }}>
        Transferring from <strong>{currentCourt?.name ?? "Court"}</strong>
      </div>

      <Form form={form} layout="vertical">
        {targetCourts.length === 0 ? (
          <Alert
            title="No available courts"
            description="There are no free and empty courts to transfer to."
            type="warning"
            showIcon
          />
        ) : (
          <>
            <Form.Item
              name="targetCourtId"
              label="Select Target Court"
              rules={[{ required: true, message: "Please select a court" }]}
            >
              <Select placeholder="Select a court">
                {targetCourts.map((c) => (
                  <Select.Option key={c.id} value={c.id}>
                    {c.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  );
};

export default TransferCourtModal;

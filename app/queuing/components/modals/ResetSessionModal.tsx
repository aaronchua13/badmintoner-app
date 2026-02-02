import React from 'react';
import { Modal, Typography } from 'antd';

const { Text } = Typography;

interface ResetSessionModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const ResetSessionModal: React.FC<ResetSessionModalProps> = ({
  visible,
  onCancel,
  onConfirm
}) => {
  return (
    <Modal
      title="Reset Session?"
      open={visible}
      onCancel={onCancel}
      onOk={onConfirm}
      okText="Yes, Reset"
      okButtonProps={{ danger: true }}
    >
      <Text>
        This will clear all players, courts, and history. This action cannot be undone.
      </Text>
    </Modal>
  );
};

export default ResetSessionModal;

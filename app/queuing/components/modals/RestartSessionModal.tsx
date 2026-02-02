import React from 'react';
import { Modal, Typography } from 'antd';

const { Text } = Typography;

interface RestartSessionModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const RestartSessionModal: React.FC<RestartSessionModalProps> = ({
  visible,
  onCancel,
  onConfirm
}) => {
  return (
    <Modal
      title="Restart Session?"
      open={visible}
      onCancel={onCancel}
      onOk={onConfirm}
      okText="Yes, Restart"
      okButtonProps={{ danger: true }}
    >
      <Text>
        This will reset all stats, history, and active matches, but will <Text strong>keep the player list and court setup</Text>.
      </Text>
    </Modal>
  );
};

export default RestartSessionModal;

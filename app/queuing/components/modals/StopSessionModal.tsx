import React from 'react';
import { Modal, Typography } from 'antd';
import { PoweroffOutlined } from '@ant-design/icons';

const { Text, Paragraph } = Typography;

interface StopSessionModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const StopSessionModal: React.FC<StopSessionModalProps> = ({
  visible,
  onCancel,
  onConfirm
}) => {
  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#cf1322' }}>
          <PoweroffOutlined />
          <span>Stop Session?</span>
        </div>
      }
      open={visible}
      onCancel={onCancel}
      onOk={onConfirm}
      okText="Stop Session"
      okButtonProps={{ danger: true }}
      cancelText="Cancel"
    >
      <Paragraph>
        Are you sure you want to stop the current session?
      </Paragraph>
      <ul style={{ paddingLeft: 20 }}>
        <li><Text>The session timer will stop.</Text></li>
        <li><Text>You will be able to view the session summary and statistics.</Text></li>
        <li><Text>No new matches can be started until a new session is started.</Text></li>
      </ul>
    </Modal>
  );
};

export default StopSessionModal;

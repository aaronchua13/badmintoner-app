import React from 'react';
import { Modal, Steps, Typography, Divider } from 'antd';
import { 
  UserAddOutlined, 
  AppstoreAddOutlined, 
  PlayCircleOutlined, 
  DragOutlined, 
  CheckCircleOutlined 
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

interface InstructionsModalProps {
  visible: boolean;
  onClose: () => void;
}

const InstructionsModal: React.FC<InstructionsModalProps> = ({ visible, onClose }) => {
  return (
    <Modal
      title="How to Use Badminton Queuing"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={700}
    >
      <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '8px' }}>
        <Paragraph>
          Welcome to the Badminton Queuing System! Here's a quick guide to help you manage your session efficiently.
        </Paragraph>

        <Steps
          orientation="vertical"
          items={[
            {
              title: 'Start the Session',
              status: 'process',
              icon: <PlayCircleOutlined />,
              content: (
                <div>
                  <Text>Click the <Text strong>Start Session</Text> button in the header to begin tracking time.</Text>
                  <div style={{ fontSize: '12px', color: '#faad14', marginTop: 4 }}>
                    <Text strong>Recommendation:</Text> It is recommended to add players and courts first before starting the session.
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: 2 }}>
                    This initializes the session timer which is used to calculate idle times.
                  </div>
                </div>
              ),
            },
            {
              title: 'Add Courts & Players',
              status: 'process',
              icon: <AppstoreAddOutlined />,
              content: (
                <div>
                  <Text>Use the <Text strong>+ Court</Text> and <Text strong>+ Player</Text> buttons to set up your session.</Text>
                  <ul style={{ paddingLeft: 20, margin: '4px 0' }}>
                    <li>Add courts based on availability.</li>
                    <li>Add players with their skill levels (Beginner, Intermediate, Advanced).</li>
                  </ul>
                </div>
              ),
            },
            {
              title: 'Assign Players to Courts',
              status: 'process',
              icon: <UserAddOutlined />,
              content: (
                <div>
                  <Text>Assign players to available courts:</Text>
                  <ul style={{ paddingLeft: 20, margin: '4px 0' }}>
                    <li><Text strong>List View:</Text> Click the court number button (e.g., "C1") next to a player.</li>
                    <li><Text strong>Grid View:</Text> Click the court number button on the player card.</li>
                  </ul>
                  <Text type="secondary">Players are automatically sorted by idle time to help you pick who plays next.</Text>
                </div>
              ),
            },
            {
              title: 'Manage Matches',
              status: 'process',
              icon: <DragOutlined />,
              content: (
                <div>
                  <Text>Once 2 or 4 players are assigned to a court:</Text>
                  <ol style={{ paddingLeft: 20, margin: '4px 0' }}>
                    <li>Click <Text strong>Start Match</Text> on the court card.</li>
                    <li>When the game ends, click <Text strong>Finish</Text>.</li>
                    <li>Enter the score (optional) and save.</li>
                  </ol>
                  <Text type="secondary">Finishing a match updates player stats (Games, W/L) and resets their idle timer.</Text>
                </div>
              ),
            },
            {
              title: 'Track History & Stats',
              status: 'process',
              icon: <CheckCircleOutlined />,
              content: (
                <div>
                  <Text>View past matches by clicking the <Text strong>History</Text> button.</Text>
                  <div style={{ marginTop: 4 }}>
                    Player statistics (Wins, Losses, Games Played) are updated automatically after each match.
                  </div>
                </div>
              ),
            },
          ]}
        />
        
        <Divider />
        
        <Title level={5}>Tips</Title>
        <ul style={{ paddingLeft: 20 }}>
          <li>Use the <Text strong>Reset Session</Text> option in the menu to clear all data and start over.</li>
          <li>You can remove players or courts at any time using the delete/trash icons.</li>
          <li>Use the <Text strong>Populate Dummy</Text> option to quickly test the system with sample data.</li>
        </ul>
      </div>
    </Modal>
  );
};

export default InstructionsModal;

import React from 'react';
import { Modal, Steps, Typography, Divider, Collapse, Tag } from 'antd';
import { 
  UserAddOutlined, 
  AppstoreAddOutlined, 
  PlayCircleOutlined, 
  DragOutlined, 
  TrophyOutlined,
  StopOutlined,
  BarChartOutlined,
  SettingOutlined,
  MobileOutlined
} from '@ant-design/icons';

const { Paragraph, Text } = Typography;

interface InstructionsModalProps {
  visible: boolean;
  onClose: () => void;
}

const InstructionsModal: React.FC<InstructionsModalProps> = ({ visible, onClose }) => {
  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SettingOutlined />
          <span>Badminton Queuing Guide</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
      styles={{ body: { padding: '24px' } }}
    >
      <div style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: '8px' }}>
        <Paragraph style={{ fontSize: '16px' }}>
          Welcome to the <Text strong>Badminton Queuing System</Text>! This tool helps you manage social badminton sessions fairly and efficiently by tracking idle times, organizing matches, and recording statistics.
        </Paragraph>

        <Divider>Quick Start Guide</Divider>

        <Steps
          orientation="vertical"
          size="small"
          items={[
            {
              title: <Text strong style={{ fontSize: '15px' }}>Step 1: Pre-Session Setup</Text>,
              status: 'process',
              icon: <AppstoreAddOutlined style={{ color: '#faad14' }} />,
              content: (
                <div style={{ marginBottom: 16 }}>
                  <Paragraph style={{ margin: 0 }}>
                    <Text strong>Recommendation:</Text> It is recommended to add players and courts first before starting the session.
                  </Paragraph>
                  <Paragraph style={{ marginTop: 4, color: '#666' }}>
                    This initializes the session timer which is used to calculate idle times.
                  </Paragraph>
                  <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                    <li>Use <Text strong>+ Court</Text> to add available courts.</li>
                    <li>Use <Text strong>+ Player</Text> to register players.</li>
                    <li><Text type="secondary">Tip: Use &quot;Populate Dummy Players&quot; in the menu to test the system.</Text></li>
                  </ul>
                </div>
              ),
            },
            {
              title: <Text strong style={{ fontSize: '15px' }}>Step 2: Start Session</Text>,
              status: 'process',
              icon: <PlayCircleOutlined style={{ color: '#1890ff' }} />,
              content: (
                <div style={{ marginBottom: 16 }}>
                  <Paragraph style={{ margin: 0 }}>
                    Once resources are ready, click <Text strong style={{ color: '#1890ff' }}>Start Session</Text>.
                  </Paragraph>
                  <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                    <li>The global timer will begin.</li>
                    <li>Idle timers for all added players will start counting.</li>
                  </ul>
                </div>
              ),
            },
            {
              title: <Text strong style={{ fontSize: '15px' }}>Step 3: Queue & Assign</Text>,
              status: 'process',
              icon: <UserAddOutlined style={{ color: '#52c41a' }} />,
              content: (
                <div style={{ marginBottom: 16 }}>
                  <Paragraph style={{ margin: 0 }}>
                    Manage player assignments via the <Text strong>Queue Tab</Text>.
                  </Paragraph>
                  <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                    <li><Text strong>Add to Queue:</Text> Select a player and click &quot;Add to Queue&quot;. Choose a specific queue group from the scrollable list.</li>
                    <li><Text strong>Restriction:</Text> Players currently on a court (active or idle) <Text type="danger">cannot</Text> be added to a queue.</li>
                    <li><Text strong>Mobile-Friendly:</Text> The queue list uses a compact vertical layout for easier management on small screens.</li>
                    <li><Text strong>Auto-Assign:</Text> Enable &quot;Auto&quot; mode to automatically move queued matches to free courts.</li>
                  </ul>
                </div>
              ),
            },
            {
              title: <Text strong style={{ fontSize: '15px' }}>Step 4: Run Matches</Text>,
              status: 'process',
              icon: <DragOutlined style={{ color: '#faad14' }} />,
              content: (
                <div style={{ marginBottom: 16 }}>
                  <Paragraph style={{ margin: 0 }}>
                    Control the flow of games on each court card.
                  </Paragraph>
                  <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                    <li>Click <Tag color="green">Start Match</Tag> to begin a game. This starts the match timer.</li>
                    <li>When the game ends, click <Tag color="red">Finish</Tag>.</li>
                    <li>(Optional) Enter scores to track wins/losses.</li>
                    <li>Finishing a match resets the players&apos; idle timers to 0.</li>
                  </ul>
                </div>
              ),
            },
            {
              title: <Text strong style={{ fontSize: '15px' }}>Step 5: Analyze & Conclude</Text>,
              status: 'process',
              icon: <BarChartOutlined style={{ color: '#722ed1' }} />,
              content: (
                <div style={{ marginBottom: 16 }}>
                  <Paragraph style={{ margin: 0 }}>
                    Track progress and wrap up the session.
                  </Paragraph>
                  <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                    <li>Click <Text strong>History</Text> to see a log of all played matches.</li>
                    <li>Click <Text strong>Session Summary</Text> to view the Leaderboard and detailed player stats.</li>
                    <li>Use <Text strong>Stop Session</Text> to end operations but keep the data viewable.</li>
                  </ul>
                </div>
              ),
            },
          ]}
        />
        
        <Divider>Detailed Features</Divider>
        
        <Collapse
          ghost
          items={[
            {
              key: '1',
              label: <Text strong><TrophyOutlined /> Scoring & Statistics</Text>,
              children: (
                <div>
                  <Paragraph>
                    The system tracks individual performance throughout the session:
                  </Paragraph>
                  <ul style={{ paddingLeft: 20 }}>
                    <li><Text strong>Games Played:</Text> Total matches participated in.</li>
                    <li><Text strong>Win/Loss Record:</Text> Based on entered scores.</li>
                    <li><Text strong>Win Rate:</Text> Percentage of games won.</li>
                    <li><Text strong>Point Difference:</Text> Total points scored vs. conceded.</li>
                  </ul>
                  <Text type="secondary">Note: Statistics are reset if you use &quot;Reset Session&quot;.</Text>
                </div>
              ),
            },
            {
              key: '2',
              label: <Text strong><StopOutlined /> Stopping vs. Resetting</Text>,
              children: (
                <div>
                  <Paragraph>
                    Understand the difference between Stop and Reset:
                  </Paragraph>
                  <ul>
                    <li>
                      <Text strong type="danger">Stop Session:</Text> Ends the session timer and disables new matches. 
                      Use this when the session is over but you want to share results/stats with players.
                    </li>
                    <li>
                      <Text strong type="danger">Reset Session:</Text> Completely clears all data (players, courts, history) 
                      and resets the system to a blank state. Use this to start a brand new event.
                    </li>
                  </ul>
                </div>
              ),
            },
            {
              key: '3',
              label: <Text strong><MobileOutlined /> Mobile Experience</Text>,
              children: (
                <div>
                  <Paragraph>
                    The app is fully optimized for mobile devices:
                  </Paragraph>
                  <ul style={{ paddingLeft: 20 }}>
                    <li><Text strong>Compact Header:</Text> Essential controls are prioritized. Use the &quot;More&quot; (...) menu for extra options.</li>
                    <li><Text strong>Vertical Queue:</Text> Queue items are stacked vertically for better visibility.</li>
                    <li><Text strong>Stacked Layout:</Text> Courts and Player List are stacked for easier scrolling.</li>
                    <li><Text strong>Quick Actions:</Text> Use the floating action button (+) at the bottom right to quickly add players or courts.</li>
                  </ul>
                </div>
              ),
            }
          ]}
        />
      </div>
    </Modal>
  );
};

export default InstructionsModal;

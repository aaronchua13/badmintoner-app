import React from 'react';
import { Layout, Typography, Button, Modal, Dropdown, MenuProps, Tag } from 'antd';
import { HomeOutlined, PlayCircleOutlined, HistoryOutlined, TeamOutlined, MoreOutlined, DeleteOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { formatSessionDuration } from '../utils';
import { useCustomBreakpoints } from '../hooks/useCustomBreakpoints';

const { Header } = Layout;
const { Title, Text } = Typography;

interface QueuingHeaderProps {
  sessionStartTime: number | null;
  currentTime: number;
  onStartSession: () => void;
  onResetSession: () => void;
  onOpenHistory: () => void;
  onPopulateDummy: () => void;
  onOpenInstructions: () => void;
}

const QueuingHeader: React.FC<QueuingHeaderProps> = ({
  sessionStartTime,
  currentTime,
  onStartSession,
  onResetSession,
  onOpenHistory,
  onPopulateDummy,
  onOpenInstructions
}) => {
  const { isHeaderCompact } = useCustomBreakpoints();
  const isMobile = isHeaderCompact;

  const getSessionDuration = () => {
    if (sessionStartTime === null) return 'Not Started';
    const diff = Math.floor((currentTime - sessionStartTime) / 1000);
    return formatSessionDuration(diff);
  };

  const handleReset = () => {
    Modal.confirm({
      title: 'Reset Session?',
      content: 'This will clear all players, courts, and history. This action cannot be undone.',
      okText: 'Yes, Reset',
      okType: 'danger',
      onOk: () => {
        onResetSession();
        window.location.reload();
      }
    });
  };

  const menuItems: MenuProps['items'] = [
    {
      key: 'populate',
      icon: <TeamOutlined />,
      label: 'Populate Dummy Players',
      onClick: onPopulateDummy
    },
    {
      type: 'divider'
    },
    {
      key: 'reset',
      icon: <DeleteOutlined />,
      label: 'Reset Session',
      danger: true,
      onClick: handleReset
    }
  ];

  return (
    <Header style={{ 
      background: '#fff', 
      padding: isMobile ? '0 12px' : '0 24px', 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)', 
      zIndex: 10,
      height: 64,
      lineHeight: '64px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '16px', overflow: 'hidden' }}>
        <Link href="/" passHref>
          <Button icon={<HomeOutlined />} type="text" size="middle" aria-label="Back to Home" />
        </Link>
        
        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2', justifyContent: 'center' }}>
             <Text strong style={{ fontSize: '16px' }}>🏸 B</Text>
             {sessionStartTime && (
               <Text type="secondary" style={{ fontSize: '10px' }}>
                 {getSessionDuration()}
               </Text>
             )}
          </div>
        ) : (
          <>
            <Title level={4} style={{ margin: 0, fontSize: '18px' }}>🏸 Badminton Queue</Title>
            <Tag color={sessionStartTime ? "blue" : "default"} style={{ marginLeft: 8 }}>
              {getSessionDuration()}
            </Tag>
          </>
        )}

        {!sessionStartTime && (
          <Button 
            type="primary" 
            onClick={onStartSession} 
            icon={<PlayCircleOutlined />}
            size="small"
            aria-label="Start Session"
          >
            Start
          </Button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Button 
          icon={<QuestionCircleOutlined />} 
          onClick={onOpenInstructions} 
          type="text"
          size="middle"
          aria-label="Instructions"
        />
        
        <Button 
          icon={<HistoryOutlined />} 
          onClick={onOpenHistory} 
          type="text"
          size="middle"
          aria-label="History"
        />

        <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
          <Button icon={<MoreOutlined />} type="text" size="middle" aria-label="More Actions" />
        </Dropdown>
      </div>
    </Header>
  );
};

export default QueuingHeader;

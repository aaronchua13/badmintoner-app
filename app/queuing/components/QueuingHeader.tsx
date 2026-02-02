import React from 'react';
import { Layout, Typography, Tag, Button, Space, Modal, Grid, Dropdown, MenuProps } from 'antd';
import { HomeOutlined, PlayCircleOutlined, HistoryOutlined, TeamOutlined, PlusOutlined, MoreOutlined, DeleteOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { formatSessionDuration } from '../utils';
import { useCustomBreakpoints } from '../hooks/useCustomBreakpoints';

const { Header } = Layout;
const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

interface QueuingHeaderProps {
  sessionStartTime: number | null;
  currentTime: number;
  onStartSession: () => void;
  onResetSession: () => void;
  onOpenHistory: () => void;
  onPopulateDummy: () => void;
  onOpenAddPlayer: () => void;
  onOpenAddCourt: () => void;
}

const QueuingHeader: React.FC<QueuingHeaderProps> = ({
  sessionStartTime,
  currentTime,
  onStartSession,
  onResetSession,
  onOpenHistory,
  onPopulateDummy,
  onOpenAddPlayer,
  onOpenAddCourt
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

  const mobileMenu: MenuProps['items'] = [
    {
      key: 'add-court',
      icon: <PlusOutlined />,
      label: 'Add Court',
      onClick: onOpenAddCourt
    },
    {
      key: 'populate',
      icon: <TeamOutlined />,
      label: 'Populate Dummy',
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
        <Link href="/">
          <Button icon={<HomeOutlined />} type="text" size={isMobile ? 'small' : 'middle'} />
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
            <Title level={4} style={{ margin: 0 }}>🏸 Badminton Queue</Title>
            <Tag color={sessionStartTime ? "blue" : "default"} style={{ fontSize: '14px', padding: '4px 8px' }}>
              Session: {getSessionDuration()}
            </Tag>
          </>
        )}

        {!sessionStartTime && (
          <Button 
            type="primary" 
            onClick={onStartSession} 
            icon={<PlayCircleOutlined />}
            size={isMobile ? 'small' : 'middle'}
          >
            {isMobile ? 'Start' : 'Start Session'}
          </Button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '4px' : '8px' }}>
        <Button 
          icon={<HistoryOutlined />} 
          onClick={onOpenHistory} 
          type={isMobile ? 'text' : 'default'}
          size={isMobile ? 'small' : 'middle'}
        >
          {!isMobile && 'History'}
        </Button>

        {isMobile ? (
          <Dropdown menu={{ items: mobileMenu }} trigger={['click']} placement="bottomRight">
            <Button icon={<MoreOutlined />} type="text" size="small" />
          </Dropdown>
        ) : (
          <Space>
            <Button size="small" danger onClick={handleReset} type="text">Reset</Button>
            <Button onClick={onPopulateDummy} size="small">Populate 40</Button>
            <Button icon={<TeamOutlined />} onClick={onOpenAddPlayer}>Add Player</Button>
            <Button icon={<PlusOutlined />} type="primary" onClick={onOpenAddCourt}>Add Court</Button>
          </Space>
        )}
      </div>
    </Header>
  );
};

export default QueuingHeader;

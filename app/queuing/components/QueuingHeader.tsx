import React, { useState } from 'react';
import { Layout, Typography, Button, Dropdown, MenuProps, Tag, message } from 'antd';
import { HomeOutlined, PlayCircleOutlined, HistoryOutlined, TeamOutlined, MoreOutlined, DeleteOutlined, QuestionCircleOutlined, ReloadOutlined, PoweroffOutlined, FileTextOutlined, UploadOutlined, DownloadOutlined, DatabaseOutlined, ToolOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { formatSessionDuration } from '../utils';
import { useCustomBreakpoints } from '../hooks/useCustomBreakpoints';
import ResetSessionModal from './modals/ResetSessionModal';
import RestartSessionModal from './modals/RestartSessionModal';
import StopSessionModal from './modals/StopSessionModal';

const { Header } = Layout;
const { Title, Text } = Typography;

interface QueuingHeaderProps {
  sessionStartTime: number | null;
  sessionEndTime: number | null;
  sessionStatus: 'idle' | 'active' | 'ended';
  currentTime: number;
  isOffline?: boolean;
  onStartSession: () => void;
  onStopSession: () => void;
  onResetSession: () => void;
  onRestartSession: () => void;
  onOpenHistory: () => void;
  onOpenSummary: () => void;
  onPopulateDummy: () => void;
  onOpenInstructions: () => void;
  onExportSession?: () => void;
  onImportSession?: (content: string) => void;
  hasActiveMatches?: boolean;
  onOpenPlayersDb?: () => void;
}

const QueuingHeader: React.FC<QueuingHeaderProps> = ({
  sessionStartTime,
  sessionEndTime,
  sessionStatus,
  currentTime,
  isOffline = false,
  onStartSession,
  onStopSession,
  onResetSession,
  onRestartSession,
  onOpenHistory,
  onOpenSummary,
  onPopulateDummy,
  onOpenInstructions,
  onExportSession,
  onImportSession,
  hasActiveMatches = false,
  onOpenPlayersDb,
}) => {
  const { isHeaderCompact } = useCustomBreakpoints();
  const isMobile = isHeaderCompact;
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isRestartModalOpen, setIsRestartModalOpen] = useState(false);
  const [isStopModalOpen, setIsStopModalOpen] = useState(false);
  const [fileInputEl, setFileInputEl] = useState<HTMLInputElement | null>(null);

  const getSessionDuration = () => {
    if (sessionStatus === 'idle' || sessionStartTime === null) return 'Not Started';
    if (sessionStatus === 'ended' && sessionEndTime) {
       const diff = Math.floor((sessionEndTime - sessionStartTime) / 1000);
       return formatSessionDuration(diff);
    }
    const diff = Math.floor((currentTime - sessionStartTime) / 1000);
    return formatSessionDuration(diff);
  };

  const handleReset = () => {
    setIsResetModalOpen(true);
  };

  const handleRestart = () => {
    setIsRestartModalOpen(true);
  };

  const handleStop = () => {
    if (hasActiveMatches) {
      message.error('There are active matches in progress. Please finish or stop them before stopping the session.');
      return;
    }
    setIsStopModalOpen(true);
  };

  const menuItems: MenuProps['items'] = [
    {
      key: 'summary',
      icon: <FileTextOutlined />,
      label: 'Session Summary',
      onClick: onOpenSummary,
      className: isMobile ? '' : 'hidden-desktop', 
      disabled: sessionStatus === 'idle'
    },
    {
      key: 'history',
      icon: <HistoryOutlined />,
      label: 'Match History',
      onClick: onOpenHistory,
      className: isMobile ? '' : 'hidden-desktop',
    },
    {
      key: 'instructions',
      icon: <QuestionCircleOutlined />,
      label: 'Instructions',
      onClick: onOpenInstructions,
    },
    {
      key: 'players-db',
      icon: <DatabaseOutlined />,
      label: 'Players Database',
      onClick: () => onOpenPlayersDb && onOpenPlayersDb(),
      className: isMobile ? '' : 'hidden-desktop',
    },
    {
      key: 'import',
      icon: <UploadOutlined />,
      label: 'Import Session',
      onClick: () => {
        if (sessionStatus === 'active') return;
        if (fileInputEl) fileInputEl.click();
      },
      disabled: sessionStatus === 'active'
    },
    {
      key: 'export',
      icon: <DownloadOutlined />,
      label: 'Export Session',
      onClick: () => {
        if (onExportSession) onExportSession();
      },
      disabled: sessionStatus === 'active'
    },
    {
      type: 'divider',
    },
    {
      key: 'populate',
      icon: <TeamOutlined />,
      label: 'Populate Dummy Players',
      onClick: onPopulateDummy
    },
    {
      key: 'restart',
      icon: <ReloadOutlined />,
      label: 'Restart Session',
      onClick: handleRestart,
      disabled: sessionStatus === 'idle'
    },
    {
      key: 'reset',
      icon: <DeleteOutlined />,
      label: 'Reset Session',
      onClick: handleReset,
      danger: true,
      // Reset should be enabled all the time to allow clearing setup even before start
    },
    {
      type: 'divider',
    },
    {
      key: 'reset-app-data',
      icon: <ToolOutlined />,
      label: 'Reset App Data & Repair',
      onClick: () => {
        if (confirm('This will refresh the page and clear all app caches (including Service Workers). Use this if the app is stuck or not updating. Continue?')) {
          window.location.href = '/queuing?sw=refresh';
        }
      },
      danger: true,
    },
  ];

  return (
    <>
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
        {/* Left Section: Home, Title, Timer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '16px', flex: 1, overflow: 'hidden' }}>
          <Link href="/" passHref>
            <Button icon={<HomeOutlined />} type="text" size="middle" aria-label="Back to Home" />
          </Link>
          
          {isMobile ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
               <Text strong style={{ fontSize: '16px', whiteSpace: 'nowrap' }}>Queue</Text>
               <Tag color={isOffline ? 'red' : 'green'} style={{ margin: 0, fontSize: '12px', padding: '0 4px' }}>
                 {isOffline ? 'Offline' : 'Online'}
               </Tag>
               {sessionStatus !== 'idle' && (
                 <Tag color={sessionStatus === 'active' ? "blue" : "red"} style={{ margin: 0, fontSize: '12px', padding: '0 4px' }}>
                   {getSessionDuration()}
                 </Tag>
               )}
            </div>
          ) : (
            <>
              <Title level={4} style={{ margin: 0, fontSize: '18px', whiteSpace: 'nowrap' }}>🏸 Badminton Queue</Title>
              <Tag color={isOffline ? 'red' : 'green'} style={{ marginLeft: 8 }}>{isOffline ? 'Offline' : 'Online'}</Tag>
              <Tag color={sessionStatus === 'active' ? "blue" : sessionStatus === 'ended' ? "red" : "default"} style={{ marginLeft: 8 }}>
                {getSessionDuration()}
              </Tag>
              {sessionStatus === 'ended' && <Tag color="red">ENDED</Tag>}
            </>
          )}
        </div>

        {/* Right Section: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '4px' : '8px' }}>
          
          {/* Primary Action Button (Start/Stop) - Always visible if actionable */}
          {sessionStatus === 'idle' && (
            <Button 
              type="primary" 
              onClick={onStartSession} 
              icon={<PlayCircleOutlined />}
              size={isMobile ? "small" : "middle"}
            >
              Start
            </Button>
          )}

          {sessionStatus === 'active' && (
            <Button 
              danger
              onClick={handleStop} 
              icon={<PoweroffOutlined />}
              size={isMobile ? "small" : "middle"}
            >
              {isMobile ? 'Stop' : 'Stop Session'}
            </Button>
          )}

          {/* Secondary Actions - Desktop Only (Icons) */}
          {!isMobile && (
            <>
              {sessionStatus !== 'idle' && (
                <Button 
                  icon={<FileTextOutlined />} 
                  onClick={onOpenSummary} 
                  type={sessionStatus === 'ended' ? 'primary' : 'text'}
                >
                  Summary
                </Button>
              )}
               <Button 
                onClick={handleRestart} 
                icon={<ReloadOutlined />}
                type="text"
                disabled={sessionStatus === 'idle'}
              >
                Restart
              </Button>
              <Button icon={<HistoryOutlined />} onClick={onOpenHistory} type="text" />
              <Button icon={<QuestionCircleOutlined />} onClick={onOpenInstructions} type="text" />
            </>
          )}

          {/* Mobile Only: Summary Icon Button */}
          {isMobile && sessionStatus !== 'idle' && (
             <Button 
               icon={<FileTextOutlined />} 
               onClick={onOpenSummary} 
               type={sessionStatus === 'ended' ? 'primary' : 'text'}
               size="small"
             />
          )}

          {/* More Menu - Always visible, content changes based on screen size */}
          <Dropdown 
            menu={{ 
              items: isMobile ? menuItems : menuItems.filter(i => ['populate', 'reset', 'import', 'export', 'players-db', 'reset-app-data'].includes(i?.key as string)) 
            }}  
            trigger={['click']} 
            placement="bottomRight"
          >
            <Button icon={<MoreOutlined />} type="text" size="middle" />
          </Dropdown>
        </div>
      </Header>

      <input
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        ref={(el) => setFileInputEl(el)}
        onChange={async (e) => {
          const target = e.currentTarget;
          const file = target.files && target.files[0];
          if (!file) return;
          if (sessionStatus === 'active') return;
          try {
            const text = await file.text();
            if (onImportSession) onImportSession(text);
          } catch {}
          target.value = '';
        }}
      />

      <ResetSessionModal
        visible={isResetModalOpen}
        onCancel={() => setIsResetModalOpen(false)}
        onConfirm={() => {
          onResetSession();
          setIsResetModalOpen(false);
        }}
      />
      
      <RestartSessionModal
        visible={isRestartModalOpen}
        onCancel={() => setIsRestartModalOpen(false)}
        onConfirm={() => {
          onRestartSession();
          setIsRestartModalOpen(false);
        }}
      />

      <StopSessionModal
        visible={isStopModalOpen}
        onCancel={() => setIsStopModalOpen(false)}
        onConfirm={() => {
          onStopSession();
          setIsStopModalOpen(false);
        }}
      />
    </>
  );
};

export default QueuingHeader;

'use client';

import React, { useState } from 'react';
import { Layout, Row, Col, FloatButton, Form, Grid, message } from 'antd';
import { PlusOutlined, UserAddOutlined, AppstoreAddOutlined, DatabaseOutlined, CloseOutlined } from '@ant-design/icons';
import { PlayerLevel, Gender } from './types';
import { useQueuingState } from './hooks/useQueuingState';
import { useCustomBreakpoints } from './hooks/useCustomBreakpoints';
import QueuingHeader from './components/QueuingHeader';
import PlayerPanel from './components/PlayerPanel';
import CourtCard from './components/CourtCard';
import AddPlayerModal from './components/modals/AddPlayerModal';
import AddCourtModal from './components/modals/AddCourtModal';
import FinishMatchModal from './components/modals/FinishMatchModal';
import StopMatchModal from './components/modals/StopMatchModal';
import HistoryModal from './components/modals/HistoryModal';
import PlayerDetailsModal from './components/modals/PlayerDetailsModal';
import InstructionsModal from './components/modals/InstructionsModal';
import SessionSummaryModal from './components/modals/SessionSummaryModal';
import TransferCourtModal from './components/modals/TransferCourtModal';
import PlayersDatabaseModal from './components/modals/PlayersDatabaseModal';
import styles from './QueuingClient.module.css';

const { Content } = Layout;

export default function QueuingClient() {
  const { state, actions } = useQueuingState();
  const { sessionStartTime, sessionEndTime, sessionStatus, currentTime, courts, players, history, queue, autoAssignQueue, courtHistory, isLoaded } = state;

  // Freeze time if session is ended to stop idle timers
  const effectiveTime = (sessionStatus === 'ended' && sessionEndTime) ? sessionEndTime : currentTime;

  const [isAddPlayerOpen, setIsAddPlayerOpen] = useState(false);
  const [isAddCourtOpen, setIsAddCourtOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [finishingCourtId, setFinishingCourtId] = useState<string | null>(null);
  const [stoppingCourtId, setStoppingCourtId] = useState<string | null>(null);
  const [transferringCourtId, setTransferringCourtId] = useState<string | null>(null);
  const [viewingPlayerId, setViewingPlayerId] = useState<string | null>(null);
  const [addPlayerMode, setAddPlayerMode] = useState<'close' | 'keep'>('close');
  const [isPlayersDbOpen, setIsPlayersDbOpen] = useState(false);
  const [isFabOpen, setIsFabOpen] = useState(false);

  const [addPlayerForm] = Form.useForm();
  const [addCourtForm] = Form.useForm();
  const [finishMatchForm] = Form.useForm();
  const [stopMatchForm] = Form.useForm();

  const screens = Grid.useBreakpoint();
  const { isCourtsSingleColumn } = useCustomBreakpoints();
  
  // Mobile layout logic matches the original file
  const isMobileLayout = (screens.xs || screens.sm) && !screens.md; 

  if (!isLoaded) return null;

  const handleAddPlayer = (values: { name: string; level: PlayerLevel; gender: Gender }) => {
    const res = actions.addPlayer(values);
    if (!res.ok) {
      message.error(res.error || 'Player exists in database');
      return;
    }
    addPlayerForm.resetFields(['name']);
    if (addPlayerMode === 'close') {
      setIsAddPlayerOpen(false);
    }
  };

  const handleAddCourt = (values: { name: string }) => {
    actions.addCourt(values.name);
    addCourtForm.resetFields();
    setIsAddCourtOpen(false);
  };

  const handleFinishMatch = (values: { team1Score?: number; team2Score?: number; winningTeam?: number }) => {
    if (finishingCourtId) {
      actions.finishMatch(finishingCourtId, values);
      finishMatchForm.resetFields();
      setFinishingCourtId(null);
    }
  };

  const handleStopMatch = (values: { reason: string }) => {
    if (stoppingCourtId) {
      actions.stopMatch(stoppingCourtId, values.reason);
      stopMatchForm.resetFields();
      setStoppingCourtId(null);
    }
  };

  const handleTransferMatch = (targetCourtId: string) => {
    if (transferringCourtId) {
      actions.transferMatch(transferringCourtId, targetCourtId);
      setTransferringCourtId(null);
    }
  };

  const handleStopSession = () => {
    actions.stopSession();
    setIsSummaryOpen(true);
  };

  const viewingPlayer = players.find(p => p.id === viewingPlayerId);
  const finishingCourt = courts.find(c => c.id === finishingCourtId);
  const transferringCourt = courts.find(c => c.id === transferringCourtId);

  const hasActiveMatches = courts.some(court => court.status === 'active');

  return (
    <Layout className={styles.layout}>
      <QueuingHeader 
        sessionStartTime={sessionStartTime}
        sessionEndTime={sessionEndTime}
        sessionStatus={sessionStatus}
        currentTime={effectiveTime}
        onStartSession={actions.startSession}
        onStopSession={handleStopSession}
        onResetSession={actions.resetState}
        onRestartSession={actions.restartSession}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenSummary={() => setIsSummaryOpen(true)}
        onOpenInstructions={() => setIsInstructionsOpen(true)}
        onPopulateDummy={() => actions.populateDummyPlayers(['Beginner', 'Intermediate', 'Advanced', 'Intermediate +', 'Advanced +'])}
        onOpenPlayersDb={() => setIsPlayersDbOpen(true)}
        hasActiveMatches={hasActiveMatches}
        onExportSession={() => {
          if (sessionStatus === 'active') {
            alert('Cannot export during an active session.');
            return;
          }
          actions.exportSession();
        }}
        onImportSession={(content: string) => {
          const res = actions.importSession(content);
          if (!res.ok && res.error) {
            alert(res.error);
            return;
          }
          setIsHistoryOpen(false);
          setIsSummaryOpen(false);
        }}
      />
      
      <Content className={styles.content}>
        {isMobileLayout ? (
          <div className={styles.mobileContentWrapper}>
            <Row gutter={[16, 16]}>
              {courts.map(court => (
                <Col span={24} key={court.id}>
                  <CourtCard 
                    court={court}
                    players={players}
                    currentTime={effectiveTime}
                    sessionStartTime={sessionStatus === 'active' ? sessionStartTime : null}
                    onUpdateName={actions.updateCourtName}
                    onRemove={actions.removeCourt}
                    onStartMatch={actions.startMatch}
                    onFinishMatch={(id) => setFinishingCourtId(id)}
                    onStopMatch={(id) => setStoppingCourtId(id)}
                    onTransfer={(id) => setTransferringCourtId(id)}
                    onTogglePlayer={actions.togglePlayerSelection}
                    onClearCourt={actions.clearCourt}
                  />
                </Col>
              ))}
            </Row>
            <PlayerPanel 
              players={players}
              courts={courts}
              sessionStartTime={sessionStartTime}
              currentTime={effectiveTime}
              onToggleSelection={actions.togglePlayerSelection}
              onViewPlayer={setViewingPlayerId}
              onRemovePlayer={actions.removePlayer}
              onToggleActive={actions.togglePlayerActive}
              isMobile={true}
              queue={queue}
              autoAssignQueue={autoAssignQueue}
              onSetAutoAssignQueue={actions.setAutoAssignQueue}
              onAssignQueueToCourt={actions.assignQueueToCourt}
              onRemoveQueueItem={actions.removeQueueItem}
              onMoveQueueItem={actions.moveQueueItem}
              onRemovePlayerFromQueue={actions.removePlayerFromQueue}
              onRemovePlayersFromQueue={actions.removePlayersFromQueue}
              onCreateQueue={actions.createQueueItem}
              onAddPlayerToQueue={actions.addPlayerToQueueItem}
            />
          </div>
        ) : (
          <Row gutter={[24, 24]}>
            <Col xs={24} md={12} lg={12}>
              <Row gutter={[16, 16]}>
                {courts.map(court => (
                  <Col span={isCourtsSingleColumn ? 24 : 12} key={court.id}>
                    <CourtCard 
                      key={court.id}
                      court={court}
                      players={players}
                      currentTime={effectiveTime}
                      sessionStartTime={sessionStatus === 'active' ? sessionStartTime : null}
                      onUpdateName={actions.updateCourtName}
                      onRemove={actions.removeCourt}
                      onStartMatch={actions.startMatch}
                      onFinishMatch={(id) => setFinishingCourtId(id)}
                      onStopMatch={(id) => setStoppingCourtId(id)}
                      onTransfer={(id) => setTransferringCourtId(id)}
                      onTogglePlayer={actions.togglePlayerSelection}
                    onClearCourt={actions.clearCourt}
                    />
                  </Col>
                ))}
              </Row>
            </Col>
            <Col xs={24} md={12} lg={12}>
              <PlayerPanel 
                players={players}
                courts={courts}
                sessionStartTime={sessionStartTime}
                currentTime={effectiveTime}
                onToggleSelection={actions.togglePlayerSelection}
                onViewPlayer={setViewingPlayerId}
                onRemovePlayer={actions.removePlayer}
                onToggleActive={actions.togglePlayerActive}
                queue={queue}
                autoAssignQueue={autoAssignQueue}
                onSetAutoAssignQueue={actions.setAutoAssignQueue}
                onAssignQueueToCourt={actions.assignQueueToCourt}
                onRemoveQueueItem={actions.removeQueueItem}
                onMoveQueueItem={actions.moveQueueItem}
                onRemovePlayerFromQueue={actions.removePlayerFromQueue}
                onRemovePlayersFromQueue={actions.removePlayersFromQueue}
                onCreateQueue={actions.createQueueItem}
                onAddPlayerToQueue={actions.addPlayerToQueueItem}
              />
            </Col>
          </Row>
        )}
      </Content>

      {(sessionStatus === 'active' || sessionStatus === 'idle') && (
        <>
          {isFabOpen && (
            <div 
              className={styles.fabOverlay} 
              onClick={() => setIsFabOpen(false)} 
            />
          )}
          <div className={styles.fabContainer}>
            {isFabOpen && (
              <div className={styles.fabItems}>
                <div className={styles.fabItem}>
                  <span className={styles.fabLabel}>
                    Add Player
                  </span>
                  <FloatButton 
                    icon={<UserAddOutlined />} 
                    onClick={() => {
                      setIsAddPlayerOpen(true);
                      setIsFabOpen(false);
                    }} 
                    className={styles.staticButton}
                  />
                </div>
                <div className={`${styles.fabItem} ${styles.delay1}`}>
                  <span className={styles.fabLabel}>
                    Add Court
                  </span>
                  <FloatButton 
                    icon={<AppstoreAddOutlined />} 
                    onClick={() => {
                      setIsAddCourtOpen(true);
                      setIsFabOpen(false);
                    }} 
                    className={styles.staticButton}
                  />
                </div>
                <div className={`${styles.fabItem} ${styles.delay2}`}>
                  <span className={styles.fabLabel}>
                    Add from Players DB
                  </span>
                  <FloatButton 
                    icon={<DatabaseOutlined />} 
                    onClick={() => {
                      setIsPlayersDbOpen(true);
                      setIsFabOpen(false);
                    }} 
                    className={styles.staticButton}
                  />
                </div>
              </div>
            )}
            <FloatButton 
              icon={isFabOpen ? <CloseOutlined /> : <PlusOutlined />} 
              type="primary"
              onClick={() => setIsFabOpen(!isFabOpen)}
              className={styles.staticButton}
            />
          </div>
        </>
      )}

      <AddPlayerModal
        visible={isAddPlayerOpen}
        onCancel={() => setIsAddPlayerOpen(false)}
        onAdd={handleAddPlayer}
        form={addPlayerForm}
        mode={addPlayerMode}
        setMode={setAddPlayerMode}
      />

      <AddCourtModal
        visible={isAddCourtOpen}
        onCancel={() => setIsAddCourtOpen(false)}
        onCreate={handleAddCourt}
        form={addCourtForm}
      />

      <FinishMatchModal
        visible={!!finishingCourtId}
        onCancel={() => setFinishingCourtId(null)}
        onFinish={handleFinishMatch}
        form={finishMatchForm}
        court={finishingCourt}
        players={players}
      />

      <StopMatchModal
        visible={!!stoppingCourtId}
        onCancel={() => setStoppingCourtId(null)}
        onStop={handleStopMatch}
        form={stopMatchForm}
      />

      <TransferCourtModal
        visible={!!transferringCourtId}
        onCancel={() => setTransferringCourtId(null)}
        onTransfer={handleTransferMatch}
        courts={courts}
        currentCourt={transferringCourt}
      />

      <HistoryModal
        visible={isHistoryOpen}
        onCancel={() => setIsHistoryOpen(false)}
        history={history}
      />
      
      <SessionSummaryModal
        visible={isSummaryOpen}
        onClose={() => setIsSummaryOpen(false)}
        sessionStartTime={sessionStartTime}
        sessionEndTime={sessionEndTime || (sessionStatus === 'active' ? currentTime : null)}
        currentTime={effectiveTime}
        players={players}
        courts={courts}
        history={history}
        courtHistory={courtHistory}
      />
      
      <InstructionsModal
        visible={isInstructionsOpen}
        onClose={() => setIsInstructionsOpen(false)}
      />

      <PlayerDetailsModal
        visible={!!viewingPlayerId}
        onCancel={() => setViewingPlayerId(null)}
        player={viewingPlayer}
        players={players}
        history={history}
        onUpdateLevel={actions.updatePlayerLevel}
        onUpdateGender={actions.updatePlayerGender}
      />
      
      <PlayersDatabaseModal
        visible={isPlayersDbOpen}
        onClose={() => setIsPlayersDbOpen(false)}
        existingPlayers={players.map(p => p.name)}
        onAddToSession={(list) => {
          let added = 0;
          for (const item of list) {
            if (players.some(p => p.name.trim().toLowerCase() === item.name.trim().toLowerCase())) {
              continue;
            }
            const res = actions.addPlayer({ name: item.name, gender: item.gender, level: item.level });
            if (res.ok) added++;
          }
          if (added === 0) {
            message.info('No new players added to session');
          } else {
            message.success(`Added ${added} player(s) to session`);
          }
        }}
      />
    </Layout>
  );
}

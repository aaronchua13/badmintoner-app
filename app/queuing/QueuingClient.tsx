'use client';

import React, { useState } from 'react';
import { Layout, Row, Col, FloatButton, Form, Grid } from 'antd';
import { PlusOutlined, UserAddOutlined, AppstoreAddOutlined } from '@ant-design/icons';
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

const { Content } = Layout;

export default function QueuingClient() {
  const { state, actions } = useQueuingState();
  const { sessionStartTime, sessionEndTime, sessionStatus, currentTime, courts, players, history, queue, autoAssignQueue, isLoaded } = state;

  // Freeze time if session is ended to stop idle timers
  const effectiveTime = (sessionStatus === 'ended' && sessionEndTime) ? sessionEndTime : currentTime;

  const [isAddPlayerOpen, setIsAddPlayerOpen] = useState(false);
  const [isAddCourtOpen, setIsAddCourtOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [finishingCourtId, setFinishingCourtId] = useState<string | null>(null);
  const [stoppingCourtId, setStoppingCourtId] = useState<string | null>(null);
  const [viewingPlayerId, setViewingPlayerId] = useState<string | null>(null);
  const [addPlayerMode, setAddPlayerMode] = useState<'close' | 'keep'>('close');

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
    actions.addPlayer(values);
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

  const handleStopSession = () => {
    actions.stopSession();
    setIsSummaryOpen(true);
  };

  const viewingPlayer = players.find(p => p.id === viewingPlayerId);
  const finishingCourt = courts.find(c => c.id === finishingCourtId);

  return (
    <Layout style={{ minHeight: '100vh' }}>
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
      />
      
      <Content style={{ padding: isMobileLayout ? '12px' : '24px' }}>
        {isMobileLayout ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                    onTogglePlayer={actions.togglePlayerSelection}
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
                      onTogglePlayer={actions.togglePlayerSelection}
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

      {sessionStatus === 'active' && (
        <FloatButton.Group
          trigger="click"
          type="primary"
          style={{ right: 24, bottom: 24 }}
          icon={<PlusOutlined />}
        >
          <FloatButton 
            icon={<UserAddOutlined />} 
            onClick={() => setIsAddPlayerOpen(true)} 
          />
          <FloatButton 
            icon={<AppstoreAddOutlined />} 
            onClick={() => setIsAddCourtOpen(true)} 
          />
        </FloatButton.Group>
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
        history={history}
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
    </Layout>
  );
}

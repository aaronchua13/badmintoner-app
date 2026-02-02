'use client';

import React, { useState } from 'react';
import { Layout, Row, Col, FloatButton, Form, Grid } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
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

const { Content } = Layout;

export default function QueuingClient() {
  const { state, actions } = useQueuingState();
  const { sessionStartTime, currentTime, courts, players, history, isLoaded } = state;

  const [isAddPlayerOpen, setIsAddPlayerOpen] = useState(false);
  const [isAddCourtOpen, setIsAddCourtOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [finishingCourtId, setFinishingCourtId] = useState<string | null>(null);
  const [stoppingCourtId, setStoppingCourtId] = useState<string | null>(null);
  const [viewingPlayerId, setViewingPlayerId] = useState<string | null>(null);
  const [addPlayerMode, setAddPlayerMode] = useState<'close' | 'keep'>('close');

  const [addPlayerForm] = Form.useForm();
  const [addCourtForm] = Form.useForm();
  const [finishMatchForm] = Form.useForm();
  const [stopMatchForm] = Form.useForm();

  const screens = Grid.useBreakpoint();
  const { isHeaderCompact, isCourtsSingleColumn } = useCustomBreakpoints();
  // Use isHeaderCompact for mobile layout switching as it aligns with the "mobile view" request
  // But strictly speaking, mobile layout stacking might be better tied to a smaller breakpoint like 768px (md) or just reuse isHeaderCompact if user wants full mobile experience below 1000px
  // User said "header look like mobile header" below 1000px.
  // User said "court if screen size is below 1366px make column only 1".
  
  // Let's keep the main layout stacking (sidebar vs content) at standard mobile breakpoint (md), 
  // or should we follow the header?
  // "if screen size is below 1000px, make the header look like mobile header" -> specific to header.
  // "if screen size is below 1366px make column only 1" -> specific to courts.
  
  // The existing isMobile logic affects:
  // 1. Padding (12px vs 24px)
  // 2. Main layout structure (Column vs Row split)
  // 3. CourtCard props (which we reverted)
  
  // If I use standard breakpoint for main layout, but custom for courts:
  const isMobileLayout = (screens.xs || screens.sm) && !screens.md; 

  if (!isLoaded) return null;

  const handleAddPlayer = (values: any) => {
    actions.addPlayer(values);
    addPlayerForm.resetFields(['name']);
    if (addPlayerMode === 'close') {
      setIsAddPlayerOpen(false);
    }
  };

  const handleAddCourt = (values: any) => {
    actions.addCourt(values.name);
    addCourtForm.resetFields();
    setIsAddCourtOpen(false);
  };

  const handleFinishMatch = (values: any) => {
    if (finishingCourtId) {
      actions.finishMatch(finishingCourtId, values);
      finishMatchForm.resetFields();
      setFinishingCourtId(null);
    }
  };

  const handleStopMatch = (values: any) => {
    if (stoppingCourtId) {
      actions.stopMatch(stoppingCourtId, values.reason);
      stopMatchForm.resetFields();
      setStoppingCourtId(null);
    }
  };

  const viewingPlayer = players.find(p => p.id === viewingPlayerId);
  const finishingCourt = courts.find(c => c.id === finishingCourtId);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <QueuingHeader 
        sessionStartTime={sessionStartTime}
        currentTime={currentTime}
        onStartSession={actions.startSession}
        onResetSession={actions.resetState}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onPopulateDummy={() => actions.populateDummyPlayers(['Beginner', 'Intermediate', 'Advanced', 'Intermediate +', 'Advanced +'])}
        onOpenAddPlayer={() => setIsAddPlayerOpen(true)}
        onOpenAddCourt={() => setIsAddCourtOpen(true)}
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
                    currentTime={currentTime}
                    sessionStartTime={sessionStartTime}
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
              currentTime={currentTime}
              onToggleSelection={actions.togglePlayerSelection}
              onViewPlayer={setViewingPlayerId}
              onRemovePlayer={actions.removePlayer}
              onToggleActive={actions.togglePlayerActive}
              isMobile={true}
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
                    currentTime={currentTime}
                    sessionStartTime={sessionStartTime}
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
                currentTime={currentTime}
                onToggleSelection={actions.togglePlayerSelection}
                onViewPlayer={setViewingPlayerId}
                onRemovePlayer={actions.removePlayer}
                onToggleActive={actions.togglePlayerActive}
              />
            </Col>
          </Row>
        )}
      </Content>

      <FloatButton 
        icon={<PlusOutlined />} 
        type="primary" 
        style={{ right: 24, bottom: 24 }} 
        onClick={() => setIsAddPlayerOpen(true)} 
      />

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

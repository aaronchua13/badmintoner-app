'use client';

import React, { useState, useEffect } from 'react';
import { Typography, Card, Button, Avatar, App, Row, Col, Grid } from 'antd';
import { UserOutlined, EditOutlined, SettingOutlined, TeamOutlined, CalendarOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { EditProfileModal } from './components/EditProfileModal';
import { AccountSettingsModal } from './components/AccountSettingsModal';
import { updateProfileAction, updateAccountAction } from '@/app/actions/player';

const { Title, Text, Paragraph } = Typography;
const { useBreakpoint } = Grid;

interface PlayerProfileData {
  _id: string;
  first_name: string;
  last_name: string;
  email: string;
  username?: string;
  image?: string;
  bio?: string;
  clubs?: string[];
  created_at?: string;
  createdAt?: string;
}

interface ProfileClientProps {
  profile: PlayerProfileData;
  currentUser: PlayerProfileData | null;
}

export default function ProfileClient({ profile: initialProfile, currentUser }: ProfileClientProps) {
  const [profile, setProfile] = useState(initialProfile);
  
  // Modals state
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);
  
  // Loading states for actions
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [updatingAccount, setUpdatingAccount] = useState(false);

  const router = useRouter();
  const { message } = App.useApp();
  const screens = useBreakpoint();
  
  // Fix hydration mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line
    setMounted(true);
  }, []);

  const isMobile = mounted ? !screens.md : false;

  const isOwnProfile = currentUser && profile && currentUser._id === profile._id;
  
  const joinedDate = profile.created_at || profile.createdAt;

  const handleEditProfile = async (values: { first_name: string; last_name: string; username: string; bio?: string }) => {
    setUpdatingProfile(true);
    const result = await updateProfileAction(values);
    setUpdatingProfile(false);

    if (result.error) {
        message.error(result.error);
    } else {
        message.success('Profile updated successfully');
        setIsEditProfileOpen(false);
        // Optimistic update or router refresh
        setProfile({ ...profile, ...values });
        
        if (values.username && values.username !== profile.username) {
             router.push(`/player/profile/${values.username}`);
        } else {
             router.refresh();
        }
    }
  };

  const handleAccountSettings = async (values: { email?: string; password?: string }) => {
    setUpdatingAccount(true);
    const result = await updateAccountAction(values);
    setUpdatingAccount(false);

    if (result.error) {
        message.error(result.error);
    } else {
        message.success('Account updated successfully');
        setIsAccountSettingsOpen(false);
        router.refresh();
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <Card variant="borderless" style={{ marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <Row gutter={[24, 24]} align="middle">
          <Col xs={24} md={6} style={{ textAlign: 'center' }}>
            <Avatar 
              size={120} 
              src={profile.image} 
              icon={<UserOutlined />} 
              style={{ marginBottom: '16px', border: '4px solid #f0f2f5' }}
            />
          </Col>
          <Col xs={24} md={12} style={{ textAlign: isMobile ? 'center' : 'left' }}>
            <div>
              <Title level={2} style={{ marginBottom: '8px' }}>
                {profile.first_name} {profile.last_name}
              </Title>
              <Text type="secondary" style={{ fontSize: '16px', display: 'block', marginBottom: '16px' }}>
                @{profile.username || 'username'}
              </Text>
              
              {profile.bio && (
                <Paragraph style={{ marginBottom: '16px', color: '#595959' }}>
                  {profile.bio}
                </Paragraph>
              )}

              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: isMobile ? 'center' : 'flex-start' }}>
                {profile.clubs && profile.clubs.length > 0 && (
                  <Text type="secondary">
                    <TeamOutlined style={{ marginRight: '4px' }} /> 
                    {profile.clubs.length} Clubs
                  </Text>
                )}
                {joinedDate && (
                    <Text type="secondary">
                    <CalendarOutlined style={{ marginRight: '4px' }} />
                    Joined {new Date(joinedDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </Text>
                )}
              </div>
            </div>
          </Col>
          <Col xs={24} md={6} style={{ textAlign: isMobile ? 'center' : 'right' }}>
            {isOwnProfile && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: isMobile ? 'center' : 'flex-end' }}>
                <Button 
                  icon={<EditOutlined />} 
                  onClick={() => setIsEditProfileOpen(true)}
                >
                  Edit Profile
                </Button>
                <Button 
                  icon={<SettingOutlined />} 
                  onClick={() => setIsAccountSettingsOpen(true)}
                >
                  Account Settings
                </Button>
              </div>
            )}
          </Col>
        </Row>
      </Card>
      
      {/* Modals */}
      <EditProfileModal
        open={isEditProfileOpen}
        onCancel={() => setIsEditProfileOpen(false)}
        onFinish={handleEditProfile}
        initialValues={{
          first_name: profile.first_name,
          last_name: profile.last_name,
          username: profile.username || '',
          bio: profile.bio || '',
        }}
        loading={updatingProfile}
      />

      <AccountSettingsModal
        open={isAccountSettingsOpen}
        onCancel={() => setIsAccountSettingsOpen(false)}
        onFinish={handleAccountSettings}
        loading={updatingAccount}
        initialValues={{
            email: profile.email
        }}
      />
    </div>
  );
}

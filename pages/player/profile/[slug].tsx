import React, { useEffect, useState, useCallback } from 'react';
import MainLayout from '@/layouts/MainLayout';
import { Typography, Card, Button, Avatar, App, Row, Col, Statistic, Spin, Divider } from 'antd';
import { UserOutlined, EditOutlined, SettingOutlined, TeamOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { api } from '@/utils/api';
import { useRouter } from 'next/router';
import { EditProfileModal } from '@/components/player/profile/EditProfileModal';
import { AccountSettingsModal } from '@/components/player/profile/AccountSettingsModal';

const { Title, Text, Paragraph } = Typography;

interface PlayerProfileData {
  _id: string;
  first_name: string;
  last_name: string;
  email: string;
  username?: string;
  image?: string;
  bio?: string;
  clubs?: string[];
}

export default function PlayerProfile() {
  const [profile, setProfile] = useState<PlayerProfileData | null>(null);
  const [currentUser, setCurrentUser] = useState<PlayerProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);
  
  // Loading states for actions
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [updatingAccount, setUpdatingAccount] = useState(false);

  const router = useRouter();
  const { slug } = router.query;
  const { message } = App.useApp();

  const isOwnProfile = currentUser && profile && currentUser._id === profile._id;

  const fetchProfile = useCallback(async () => {
    if (!slug) return;

    try {
      const token = localStorage.getItem('token');
      // Fetch public profile based on slug
      const data = await api.get<PlayerProfileData>(`/players/profile/${slug}`, token || undefined);
      setProfile(data);

      // Also fetch current user if logged in to check ownership
      if (token) {
        try {
          const me = await api.get<PlayerProfileData>('/players/profile', token);
          setCurrentUser(me);
        } catch {
          // Ignore if "me" fetch fails, just means we can't edit
        }
      }
      
    } catch (error) {
      console.error('Failed to fetch profile', error);
      message.error('Player not found');
      router.push('/');
    } finally {
      setLoading(false);
    }
  }, [slug, router, message]);

  useEffect(() => {
    if (slug) {
      fetchProfile();
    }
  }, [fetchProfile, slug]);

  const handleEditProfile = async (values: { first_name: string; last_name: string; username?: string; bio?: string }) => {
    setUpdatingProfile(true);
    try {
      const token = localStorage.getItem('token');
      await api.patch('/players/profile', values, token!);
      message.success('Profile updated successfully');
      setIsEditProfileOpen(false);
      fetchProfile();
      
      // If username changed, we might need to redirect if the URL was based on username
      if (values.username && values.username !== slug) {
         router.push(`/player/profile/${values.username}`);
      }
    } catch (error) {
      const err = error as Error;
      message.error(err.message || 'Failed to update profile');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleAccountSettings = async (values: { email?: string; password?: string }) => {
    setUpdatingAccount(true);
    try {
      const token = localStorage.getItem('token');
      const updateData: { email?: string; password?: string } = {};
      if (values.email && values.email !== profile?.email) updateData.email = values.email;
      if (values.password) updateData.password = values.password;

      if (Object.keys(updateData).length === 0) {
        message.info('No changes to save');
        setUpdatingAccount(false);
        return;
      }

      await api.patch('/players/profile', updateData, token!);
      message.success('Account settings updated successfully');
      setIsAccountSettingsOpen(false);
      fetchProfile();
    } catch (error) {
      const err = error as Error;
      message.error(err.message || 'Failed to update account settings');
    } finally {
      setUpdatingAccount(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div style={{ textAlign: 'center', padding: '100px' }}>
          <Spin size="large" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '40px' }}>
        {/* Cover Photo Area */}
        <div style={{ 
          height: '240px', 
          background: 'linear-gradient(135deg, #001529 0%, #1890ff 100%)',
          borderRadius: '0 0 16px 16px',
          position: 'relative',
          marginBottom: '80px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          {/* Avatar overlapped - Centered */}
          <div style={{ 
            position: 'absolute', 
            bottom: '-60px', 
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '4px',
            background: 'white',
            borderRadius: '50%',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}>
            <Avatar 
              size={140} 
              icon={<UserOutlined />} 
              src={profile?.image}
              style={{ backgroundColor: '#f0f2f5', border: '1px solid #d9d9d9' }} 
            />
          </div>
        </div>

        <div style={{ padding: '0 24px' }}>
          
          {/* Name and Basic Info - Centered */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
             <Title level={2} style={{ margin: 0 }}>
                {profile?.first_name} {profile?.last_name}
              </Title>
              <Text type="secondary" style={{ fontSize: '16px' }}>
                @{profile?.username || (profile?.first_name ? profile.first_name.toLowerCase() : '') + (profile?.last_name ? profile.last_name.toLowerCase() : '')}
              </Text>
              
              {isOwnProfile && (
                <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center', gap: '12px' }}>
                  <Button icon={<EditOutlined />} onClick={() => setIsEditProfileOpen(true)}>
                    Edit Profile
                  </Button>
                  <Button icon={<SettingOutlined />} onClick={() => setIsAccountSettingsOpen(true)}>
                    Settings
                  </Button>
                </div>
              )}
          </div>

          <Divider />

          {/* Main Content Grid */}
          <Row gutter={[32, 32]}>
            {/* Left Column: About */}
            <Col xs={24} md={16}>
              <Card 
                title={<Title level={4} style={{ margin: 0 }}>About</Title>} 
                bordered={false} 
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: '8px' }}
              >
                 {profile?.bio ? (
                  <Paragraph style={{ fontSize: '16px', color: '#595959', lineHeight: '1.8' }}>
                    {profile.bio}
                  </Paragraph>
                ) : (
                  <Paragraph style={{ color: '#8c8c8c', fontStyle: 'italic' }}>
                    {isOwnProfile ? 'No bio yet. Click "Edit Profile" to add one!' : 'No bio provided.'}
                  </Paragraph>
                )}
              </Card>
            </Col>

            {/* Right Column: Stats & Info */}
            <Col xs={24} md={8}>
              <Row gutter={[0, 24]}>
                 <Col span={24}>
                    <Card 
                      bordered={false} 
                      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: '8px' }}
                    >
                      <Statistic
                        title="Clubs Joined"
                        value={profile?.clubs?.length || 0}
                        prefix={<TeamOutlined />}
                        valueStyle={{ color: '#1890ff' }}
                      />
                    </Card>
                 </Col>
                 
                 {/* Placeholders for future stats */}
                 <Col span={24}>
                    <Card 
                      bordered={false} 
                      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: '8px' }}
                    >
                      <Statistic
                        title="Matches Played"
                        value={0}
                        prefix={<EnvironmentOutlined />}
                        suffix="matches"
                      />
                    </Card>
                 </Col>
              </Row>
            </Col>
          </Row>
        </div>

        <EditProfileModal 
          open={isEditProfileOpen}
          onCancel={() => setIsEditProfileOpen(false)}
          onFinish={handleEditProfile}
          loading={updatingProfile}
          initialValues={{
            first_name: profile?.first_name,
            last_name: profile?.last_name,
            username: profile?.username,
            bio: profile?.bio,
          }}
        />

        <AccountSettingsModal
          open={isAccountSettingsOpen}
          onCancel={() => setIsAccountSettingsOpen(false)}
          onFinish={handleAccountSettings}
          loading={updatingAccount}
          initialValues={{
            email: profile?.email,
          }}
        />
      </div>
    </MainLayout>
  );
}

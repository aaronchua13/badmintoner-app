'use client';

import React, { useState, useEffect } from 'react';
import { Typography, Card, Button, Avatar, App, Row, Col, Grid, Space, Tooltip, Spin, Empty } from 'antd';
import { UserOutlined, EditOutlined, SettingOutlined, TeamOutlined, CalendarOutlined, DeleteOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { EditProfileModal } from './components/EditProfileModal';
import { AccountSettingsModal } from './components/AccountSettingsModal';
import { updateProfileAction, updateAccountAction } from '@/app/actions/player';
import { deleteClubAction, getClubsByPlayerAction } from '@/app/actions/club-event';
import Link from 'next/link';

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

interface Schedule {
  day: string;
  start_time: string;
  end_time: string;
  court?: {
    name: string;
  };
}

interface Club {
  id: string;
  _id?: string;
  name: string;
  contact_person_name: string;
  fb_link?: string;
  established_date?: string;
  schedules?: Schedule[];
}

interface ProfileClientProps {
  profile: PlayerProfileData;
  currentUser: PlayerProfileData | null;
}

export default function ProfileClient({ profile: initialProfile, currentUser }: ProfileClientProps) {
  const [profile, setProfile] = useState(initialProfile);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loadingClubs, setLoadingClubs] = useState(false);
  
  // Modals state
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);
  
  // Loading states for actions
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [updatingAccount, setUpdatingAccount] = useState(false);

  const router = useRouter();
  const { message, modal } = App.useApp();
  const screens = useBreakpoint();
  
  // Fix hydration mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const isMobile = mounted ? !screens.md : false;

  const isOwnProfile = currentUser && profile && currentUser._id === profile._id;
  
  const joinedDate = profile.created_at || profile.createdAt;

  useEffect(() => {
    const fetchClubs = async () => {
        setLoadingClubs(true);
        try {
            const clubsData = await getClubsByPlayerAction(profile._id);
            // Type assertion since the action returns implicit types
            setClubs((clubsData as unknown as Club[]).filter((c) => c !== null));
        } catch (error) {
            console.error('Failed to fetch clubs:', error);
        } finally {
            setLoadingClubs(false);
        }
    };

    if (profile._id) {
        fetchClubs();
    }
  }, [profile._id]);

  const handleDeleteClub = (clubId: string) => {
    modal.confirm({
        title: 'Are you sure you want to delete this club?',
        content: 'This action cannot be undone.',
        okText: 'Yes, Delete',
        okType: 'danger',
        cancelText: 'Cancel',
        onOk: async () => {
            const result = await deleteClubAction(clubId);
            if (result.error) {
                message.error(result.error);
            } else {
                message.success('Club deleted successfully');
                setClubs(clubs.filter(c => (c.id || c._id) !== clubId));
                // Optionally update profile clubs list if needed, but the backend should handle the association removal
                router.refresh();
            }
        }
    });
  };

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
    if (!values.email || !values.password) {
        message.error('Please provide email or password to update');
        return;
    }
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
                {clubs.length > 0 && (
                  <Text type="secondary">
                    <TeamOutlined style={{ marginRight: '4px' }} /> 
                    {clubs.length} Clubs
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

      {/* Managed Clubs Section */}
      {(clubs.length > 0 || isOwnProfile) && (
        <Card title="Managed Clubs" style={{ marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }} extra={
            isOwnProfile && (
                <Link href="/create-club">
                    <Button type="primary" icon={<PlusOutlined />}>Create Club</Button>
                </Link>
            )
        }>
            {loadingClubs ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                    <Spin />
                </div>
            ) : clubs.length === 0 ? (
                <Empty description="No clubs found" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
                <Row gutter={[16, 16]}>
                    {clubs.map((club) => (
                        <Col xs={24} sm={12} md={12} lg={8} xl={8} xxl={8} key={club.id || club._id}>
                            <Card 
                                size="small"
                                title={<Link href={`/clubs/${club.id || club._id}`}>{club.name}</Link>}
                                extra={
                                    <Space>
                                        <Tooltip title="View">
                                            <Link href={`/clubs/${club.id || club._id}`}>
                                                <Button type="text" icon={<EyeOutlined />} size="small" />
                                            </Link>
                                        </Tooltip>
                                        {isOwnProfile && (
                                            <>
                                                <Tooltip title="Edit">
                                                    <Link href={`/player/profile/${profile.username || profile._id}/clubs/${club.id || club._id}/edit`}>
                                                        <Button 
                                                            type="text" 
                                                            icon={<EditOutlined />} 
                                                            size="small" 
                                                        />
                                                    </Link>
                                                </Tooltip>
                                                <Tooltip title="Delete">
                                                    <Button 
                                                        type="text" 
                                                        danger 
                                                        icon={<DeleteOutlined />} 
                                                        size="small" 
                                                        onClick={() => handleDeleteClub(club.id || club._id || '')}
                                                    />
                                                </Tooltip>
                                            </>
                                        )}
                                    </Space>
                                }
                            >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <Text type="secondary" style={{ fontSize: '12px' }}>
                                        Established: {club.established_date ? new Date(club.established_date).getFullYear() : 'N/A'}
                                    </Text>
                                    {club.schedules && club.schedules.length > 0 ? (
                                        <div style={{ marginTop: 8 }}>
                                            <Text strong style={{ fontSize: '12px' }}>Schedules:</Text>
                                            <ul style={{ paddingLeft: 20, margin: '4px 0', fontSize: '12px' }}>
                                                {club.schedules.map((sch, idx) => (
                                                    <li key={idx}>
                                                        {sch.day.substring(0, 3)} {sch.start_time}-{sch.end_time}
                                                        {sch.court && <div style={{ color: '#8c8c8c', fontSize: '11px' }}>@ {sch.court.name}</div>}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ) : (
                                        <Text type="secondary" style={{ fontSize: '12px' }}>No schedules</Text>
                                    )}
                                </div>
                            </Card>
                        </Col>
                    ))}
                </Row>
            )}
        </Card>
      )}

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

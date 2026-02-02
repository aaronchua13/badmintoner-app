'use client';

import { Typography, Card, Row, Col, Spin, Pagination, Button, Tag } from 'antd';
import {
  TeamOutlined,
  UserOutlined,
  FacebookFilled,
  DownOutlined,
  UpOutlined,
  CheckOutlined,
  CalendarOutlined,
  ArrowRightOutlined
} from '@ant-design/icons';
import Link from 'next/link';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { getClubsAction, getCourtsAction } from '@/app/actions/club-event';

const { Title, Text } = Typography;

interface Club {
  id: string;
  _id?: string;
  name: string;
  contact_person_name: string;
  fb_link?: string;
  allowed_player_levels?: string[];
  schedules: {
    day: string;
    start_time: string;
    end_time: string;
    court?: {
      name: string;
      location: string;
    };
  }[];
}

interface Court {
  id?: string;
  _id?: string;
  name: string;
}

// Wrapper for Suspense requirement of useSearchParams
function ClubsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // State
  const [clubs, setClubs] = useState<Club[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  
  // UI State
  const [activeCategory, setActiveCategory] = useState<string | null>(null); // Default to Location open
  const [showFilters, setShowFilters] = useState(false);

  // Read params from URL
  const page = Number(searchParams.get('page')) || 1;
  const locationParam = searchParams.get('location');
  const locationFilters = locationParam ? locationParam.split(',').filter(Boolean) : [];
  
  const dayParam = searchParams.get('day');
  const dayFilters = dayParam ? dayParam.split(',').filter(Boolean) : [];
  
  const timeParam = searchParams.get('timeOfDay');
  const timeFilters = timeParam ? timeParam.split(',').filter(Boolean) : [];

  // Constants
  const pageSize = 10;
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const times = ['Morning', 'Afternoon', 'Evening'];

  // Fetch Courts
  useEffect(() => {
    const fetchCourts = async () => {
      try {
        const result = await getCourtsAction();
        if (Array.isArray(result)) {
          setCourts(result);
        }
      } catch (error) {
        console.error('Failed to fetch courts:', error);
      }
    };
    fetchCourts();
  }, []);

  // Fetch Clubs when URL params change
  useEffect(() => {
    const fetchClubs = async () => {
      setLoading(true);
      try {
        const filters = {
          location: locationFilters,
          day: dayFilters,
          timeOfDay: timeFilters as ('Morning' | 'Afternoon' | 'Evening')[]
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: any = await getClubsAction(page, pageSize, filters);
        if (result && result.data) {
          setClubs(result.data);
          setTotal(result.total);
        } else {
          setClubs([]);
          setTotal(0);
        }
      } catch (error) {
        console.error('Failed to fetch clubs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchClubs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchParams]); // Depend on searchParams

  // URL Update Helper
  const updateFilter = (type: 'location' | 'day' | 'timeOfDay', value: string) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    const existingStr = current.get(type) || '';
    const currentValues = existingStr ? existingStr.split(',').filter(Boolean) : [];
    
    let newValues: string[];
    // Toggle value
    if (currentValues.includes(value)) {
      newValues = currentValues.filter(v => v !== value);
    } else {
      newValues = [...currentValues, value];
    }

    if (newValues.length > 0) {
      current.set(type, newValues.join(','));
    } else {
      current.delete(type);
    }

    // Reset page to 1 on filter change
    current.set('page', '1');
    
    router.push(`${pathname}?${current.toString()}`);
  };

  const clearAllFilters = () => {
    router.push(pathname);
  };

  const clearCategoryFilters = (category: string) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    const type = category === 'Location' ? 'location' : category === 'Day' ? 'day' : 'timeOfDay';
    current.delete(type);
    current.set('page', '1');
    router.push(`${pathname}?${current.toString()}`);
  };

  const toggleCategory = (category: string) => {
    if (activeCategory === category) {
      setActiveCategory(null);
    } else {
      setActiveCategory(category);
      setShowFilters(true);
    }
  };

  // Render Helpers
  const renderPill = (label: string, value: string, type: 'location' | 'day' | 'timeOfDay', isActive: boolean) => (
    <Button
      key={value}
      type={isActive ? 'primary' : 'default'}
      shape="round"
      icon={isActive ? <CheckOutlined /> : undefined}
      onClick={() => updateFilter(type, value)}
      style={{ margin: '4px' }}
    >
      {label}
    </Button>
  );

  const activeCount = locationFilters.length + dayFilters.length + timeFilters.length;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <Title level={1} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', fontSize: '1.8rem' }}>
          <TeamOutlined style={{ color: '#1890ff' }} />
          Badminton Clubs
        </Title>
      </div>

      {/* Artlist-style Filter Bar */}
      <div style={{ marginBottom: '24px' }}>
        {/* Active Filters Row (Top Left in Artlist) */}
        {activeCount > 0 && (
          <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {locationFilters.map(id => {
              const court = courts.find(c => (c.id === id || c._id === id));
              return (
                <Tag key={id} closable onClose={() => updateFilter('location', id)} color="blue" style={{ padding: '4px 10px', borderRadius: '16px' }}>
                  {court?.name || 'Location'}
                </Tag>
              );
            })}
            {dayFilters.map(day => (
              <Tag key={day} closable onClose={() => updateFilter('day', day)} color="cyan" style={{ padding: '4px 10px', borderRadius: '16px' }}>
                {day}
              </Tag>
            ))}
            {timeFilters.map(time => (
              <Tag key={time} closable onClose={() => updateFilter('timeOfDay', time)} color="purple" style={{ padding: '4px 10px', borderRadius: '16px' }}>
                {time}
              </Tag>
            ))}
            <Button type="link" onClick={clearAllFilters} size="small" style={{ color: '#999' }}>
              Clear All Filters
            </Button>
          </div>
        )}

        {/* Categories Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid #f0f0f0', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', gap: '24px', overflowX: 'auto', paddingBottom: '4px' }}>
            {['Location', 'Day', 'Time'].map(cat => {
              const isOpen = activeCategory === cat;
              return (
                <div 
                  key={cat} 
                  onClick={() => toggleCategory(cat)}
                  style={{ 
                    cursor: 'pointer', 
                    fontWeight: isOpen ? 600 : 400,
                    color: isOpen ? '#1890ff' : '#000',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {cat} {isOpen ? <UpOutlined style={{ fontSize: '10px' }} /> : <DownOutlined style={{ fontSize: '10px' }} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Expanded Filter Pills (The "Cloud") */}
        {showFilters && activeCategory && (
          <div style={{ padding: '24px 0', background: '#fafafa', borderRadius: '0 0 8px 8px', borderBottom: '1px solid #f0f0f0' }}>
             <div style={{ marginBottom: '12px', padding: '0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong>{activeCategory}</Text>
                {((activeCategory === 'Location' && locationFilters.length > 0) ||
                  (activeCategory === 'Day' && dayFilters.length > 0) ||
                  (activeCategory === 'Time' && timeFilters.length > 0)) && (
                   <Button 
                     type="link" 
                     size="small" 
                     onClick={() => clearCategoryFilters(activeCategory)}
                     style={{ color: '#999' }}
                   >
                     Clear
                   </Button>
                )}
             </div>
             <div style={{ padding: '0 16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {activeCategory === 'Location' && (
                  <>
                    {courts.map(court => renderPill(court.name, court.id || court._id || '', 'location', locationFilters.includes(court.id || court._id || '')))}
                    {courts.length === 0 && <Text type="secondary">Loading locations...</Text>}
                  </>
                )}
                {activeCategory === 'Day' && (
                  days.map(day => renderPill(day, day, 'day', dayFilters.includes(day)))
                )}
                {activeCategory === 'Time' && (
                  times.map(time => renderPill(time, time, 'timeOfDay', timeFilters.includes(time)))
                )}
             </div>
          </div>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
          <Spin size="large" />
        </div>
      ) : (
        <>
          {clubs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <Title level={3}>No results found</Title>
              <Text type="secondary">Try adjusting your filters or search criteria</Text>
              <div style={{ marginTop: '24px' }}>
                <Button onClick={clearAllFilters}>Clear Filters</Button>
              </div>
            </div>
          ) : (
            <Row gutter={[24, 24]}>
              {clubs.map((club) => (
                <Col xs={24} sm={12} lg={12} xl={8} key={club.id || club._id}>
                  <Card
                    hoverable
                    style={{ 
                      borderRadius: '16px', 
                      overflow: 'hidden', 
                      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                      border: '1px solid #f0f0f0',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                    styles={{ body: { padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' } }}
                    cover={
                      <div style={{ 
                        height: '200px', 
                        background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        position: 'relative'
                      }}>
                        <TeamOutlined style={{ fontSize: '64px', color: 'rgba(255,255,255,0.8)' }} />
                        <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex' }}>
                          <Tag color="rgba(0,0,0,0.3)" style={{ color: '#fff', border: 'none', backdropFilter: 'blur(4px)', borderRadius: '12px' }}>
                             {club.schedules?.length || 0} Sessions
                          </Tag>
                        </div>
                        {club.allowed_player_levels && club.allowed_player_levels.length > 0 && (
                          <div style={{ position: 'absolute', top: 20, left: 20, display: 'flex', gap: '4px', maxWidth: '65%', flexWrap: 'wrap' }}>
                             {club.allowed_player_levels.map((level) => (
                               <Tag key={level} color="rgba(0,0,0,0.3)" style={{ color: '#fff', border: 'none', backdropFilter: 'blur(4px)', margin: 0, borderRadius: '12px' }}>
                                  {level.charAt(0).toUpperCase() + level.slice(1)}
                               </Tag>
                             ))}
                          </div>
                        )}
                      </div>
                    }
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <div style={{ marginBottom: '16px' }}>
                        <Title level={4} style={{ marginBottom: '8px', fontSize: '1.25rem' }}>
                          <Link href={`/clubs/${club.id || club._id}`} style={{ color: 'inherit' }}>
                            {club.name}
                          </Link>
                        </Title>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#666' }}>
                           <UserOutlined />
                           <Text type="secondary">{club.contact_person_name}</Text>
                        </div>
                      </div>

                      <div style={{ marginBottom: '20px', flex: 1 }}>
                        {club.schedules && club.schedules.length > 0 ? (
                           <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                             {club.schedules.slice(0, 3).map((s, index) => (
                               <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                                  <CalendarOutlined style={{ color: '#52c41a' }} />
                                  <Text>
                                   {s.day} @ {s.start_time.substring(0, 5)} - {s.end_time.substring(0, 5)}
                                 </Text>
                               </div>
                             ))}
                             {club.schedules.length > 3 && (
                               <Text type="secondary" style={{ fontSize: '0.85rem', marginLeft: '24px' }}>
                                 +{club.schedules.length - 3} more sessions
                               </Text>
                             )}
                           </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#999' }}>
                            <CalendarOutlined />
                            <Text type="secondary">No schedules available</Text>
                          </div>
                        )}
                      </div>

                      <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: '12px' }}>
                        <Link href={`/clubs/${club.id || club._id}`} style={{ flex: 1 }}>
                          <Button type="primary" block icon={<ArrowRightOutlined />} style={{ height: '40px', borderRadius: '8px' }}>
                            View Details
                          </Button>
                        </Link>
                        {club.fb_link && (
                          <Link href={club.fb_link} target="_blank">
                            <Button icon={<FacebookFilled style={{ color: '#1877F2' }} />} style={{ height: '40px', width: '40px', borderRadius: '8px' }} />
                          </Link>
                        )}
                      </div>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          )}

          <div style={{ marginTop: '40px', textAlign: 'center', display: total > 0 ? 'block' : 'none' }}>
            <Pagination
              current={page}
              total={total}
              pageSize={pageSize}
              onChange={(p) => {
                 const current = new URLSearchParams(Array.from(searchParams.entries()));
                 current.set('page', p.toString());
                 router.push(`${pathname}?${current.toString()}`);
              }}
              showSizeChanger={false}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default function ClubsPage() {
  return (
    <Suspense fallback={<div style={{ padding: '50px', textAlign: 'center' }}><Spin size="large" /></div>}>
      <ClubsContent />
    </Suspense>
  );
}

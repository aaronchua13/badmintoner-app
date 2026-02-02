'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Form,
  Input,
  DatePicker,
  Button,
  Space,
  Typography,
  TimePicker,
  Select,
  App,
  Card,
  Row,
  Col,
  Divider,
  Modal,
  AutoComplete,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { updateClubAction } from '@/app/actions/club-event';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import dayjs, { Dayjs } from 'dayjs';

const LocationMap = dynamic(() => import('@/app/(main)/components/LocationMap'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: '300px',
        width: '100%',
        background: '#f0f0f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '8px',
      }}
    >
      Loading Map...
    </div>
  ),
});

const { Title, Text } = Typography;
const { Option } = Select;

interface Court {
  id?: string;
  _id?: string;
  name: string;
}

interface GeoapifyFeature {
  properties: {
    formatted: string;
    lat: number;
    lon: number;
  };
}

interface LocationOption {
  value: string;
  label: string;
  lat?: number;
  lon?: number;
}

interface ScheduleItem {
  temp_id?: string;
  club_id?: string;
  day: string;
  time: [Dayjs, Dayjs];
  court_id: string;
}

interface ScheduleData {
  id?: string;
  _id?: string;
  day: string;
  start_time: string;
  end_time: string;
  court_id?: string;
  court?: {
    id?: string;
    _id?: string;
  };
}

interface ClubData {
  id?: string;
  _id?: string;
  name: string;
  contact_person_name: string;
  fb_link?: string;
  allowed_player_levels?: string[];
  established_date?: string;
  schedules?: ScheduleData[];
}

interface EditClubClientProps {
  userId: string;
  initialCourts: Court[];
  initialClub: ClubData;
}

export default function EditClubClient({
  userId,
  initialCourts,
  initialClub,
}: EditClubClientProps) {
  const { message } = App.useApp();
  const router = useRouter();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [courts, setCourts] = useState<Court[]>(initialCourts || []);

  // Location Creation State
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [locationForm] = Form.useForm();
  const [locationOptions, setLocationOptions] = useState<
    { value: string; label: string; lat?: number; lon?: number }[]
  >([]);
  const [selectedCoordinates, setSelectedCoordinates] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [activeScheduleIndex, setActiveScheduleIndex] = useState<number | null>(
    null,
  );

  useEffect(() => {
    if (initialClub) {
      const schedules = (initialClub.schedules || []).map((s) => ({
        day: s.day,
        time: [dayjs(s.start_time, 'HH:mm'), dayjs(s.end_time, 'HH:mm')],
        court_id: s.court_id || s.court?.id || s.court?._id,
        temp_id: s.id || s._id || Math.random().toString(),
      }));

      form.setFieldsValue({
        name: initialClub.name,
        contact_person_name: initialClub.contact_person_name,
        fb_link: initialClub.fb_link,
        allowed_player_levels: initialClub.allowed_player_levels || [],
        established_date: initialClub.established_date ? dayjs(initialClub.established_date) : null,
        schedules: schedules,
      });
    }
  }, [initialClub, form]);

  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleLocationSearch = (value: string) => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (!value || value.length < 3) return;

    searchTimeout.current = setTimeout(async () => {
      const apiKey = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY;

      if (!apiKey) {
        console.error('Geoapify API key is missing. Please check your environment variables.');
        return;
      }

      const filter = '&filter=countrycode:ph';

      try {
        const response = await fetch(
          `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(value)}&apiKey=${apiKey}${filter}`,
        );

        if (!response.ok) {
          console.error('Geoapify API error:', response.status, response.statusText);
          return;
        }

        const data = await response.json();

        if (data.features) {
          const options = data.features.map((feature: GeoapifyFeature) => ({
            value: feature.properties.formatted,
            label: feature.properties.formatted,
            lat: feature.properties.lat,
            lon: feature.properties.lon,
          }));
          setLocationOptions(options);
        }
      } catch (error) {
        console.error('Error fetching address:', error);
      }
    }, 500);
  };

  const handleLocationSelect = (value: string, option: LocationOption) => {
    if (option.lat && option.lon) {
      setSelectedCoordinates({ lat: option.lat, lon: option.lon });
    }
  };

  const handleCreateLocationSubmit = async () => {
    try {
      const values = await locationForm.validateFields();
      const locationData = {
        name: values.name,
        location: values.address,
        latitude: selectedCoordinates?.lat,
        longitude: selectedCoordinates?.lon,
      };

      const response = await fetch('/api/courts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(locationData),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        message.error(result.error || 'Failed to create location');
      } else {
        message.success('Location created successfully');

        const newCourtId = result.id || result._id;

        if (newCourtId && result.name) {
          const newCourt = { ...result, id: newCourtId };
          setCourts((prev) => [...prev, newCourt]);

          if (activeScheduleIndex !== null) {
            const schedules = form.getFieldValue('schedules') || [];
            if (schedules[activeScheduleIndex]) {
              schedules[activeScheduleIndex].court_id = newCourtId;
              form.setFieldsValue({ schedules });
            }
          }
        } else {
          const res = await fetch('/api/courts');
          const updatedCourts = await res.json();
          if (Array.isArray(updatedCourts)) {
            setCourts(updatedCourts);
          }
        }

        setIsLocationModalOpen(false);
        locationForm.resetFields();
        setSelectedCoordinates(null);
      }
    } catch {
      // Validation error
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const schedules = (values.schedules || []).map((s: ScheduleItem) => {
        // Check if ID is temporary (generated by Math.random() or Date.now())
        // Math.random() starts with "0."
        // Date.now() is a numeric string (13+ digits)
        const isTempId = s.temp_id && (s.temp_id.startsWith('0.') || (s.temp_id.length < 24 && /^\d+$/.test(s.temp_id)));
        
        const scheduleData: ScheduleData = {
          day: s.day,
          start_time: s.time[0].format('HH:mm'),
          end_time: s.time[1].format('HH:mm'),
          court_id: s.court_id,
          is_active: true,
        } as unknown as ScheduleData;

        if (!isTempId && s.temp_id) {
          scheduleData.id = s.temp_id;
        }
        
        return scheduleData;
      });

      // Validate overlapping schedules
      for (let i = 0; i < schedules.length; i++) {
        const s1 = schedules[i];
        for (let j = i + 1; j < schedules.length; j++) {
          const s2 = schedules[j];
          if (s1.day === s2.day) {
            const s1Start = s1.start_time;
            const s1End = s1.end_time;
            const s2Start = s2.start_time;
            const s2End = s2.end_time;

            if (
              (s1Start < s2End && s1Start >= s2Start) ||
              (s2Start < s1End && s2Start >= s1Start)
            ) {
              message.error(
                `Overlapping schedule on ${s1.day}: ${s1Start}-${s1End} and ${s2Start}-${s2End}`,
              );
              setLoading(false);
              return;
            }
          }
        }
      }

      const clubData = {
        id: initialClub.id || initialClub._id,
        name: values.name,
        player_id: userId,
        contact_person_name: values.contact_person_name,
        fb_link: values.fb_link || '',
        allowed_player_levels: values.allowed_player_levels || [],
        established_date: values.established_date
          ? values.established_date.toISOString()
          : '',
        schedules: schedules,
      };

      const result = await updateClubAction(initialClub.id || initialClub._id || '', clubData);

      if (result.error) {
        message.error(result.error);
      } else {
        message.success('Club updated successfully');
        router.push('/player/profile');
        router.refresh();
      }
    } catch {
      setLoading(false);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '16px' }}>
      <Card
        title={
          <Title level={3} style={{ margin: 0, fontSize: '1.5rem' }}>
            Edit Club
          </Title>
        }
      >
        <Form form={form} layout='vertical' onFinish={handleSubmit}>
          <Form.Item
            name='name'
            label='Club Name'
            rules={[{ required: true, message: 'Please enter club name' }]}
          >
            <Input placeholder='e.g. Shuttle Smashers' size='large' />
          </Form.Item>

          <Row gutter={[16, 0]}>
            <Col xs={24} sm={24}>
              <Form.Item
                name='contact_person_name'
                label='Contact Person'
                rules={[{ required: true }]}
              >
                <Input placeholder='Name' />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name='fb_link'
            label='Facebook Page Link'
            rules={[{ type: 'url', required: false }]}
          >
            <Input
              prefix={
                <span style={{ color: '#1877F2', fontWeight: 'bold' }}>f</span>
              }
              placeholder='https://facebook.com/...'
            />
          </Form.Item>

          <Form.Item
            name='established_date'
            label='Established Date'
            rules={[{ required: false }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="allowed_player_levels"
            label="Allowed Player Levels"
            rules={[{ required: false }]}
          >
            <Select
              mode="multiple"
              placeholder="Select player levels"
              options={[
                { value: 'beginner', label: 'Beginner' },
                { value: 'intermediate', label: 'Intermediate' },
                { value: 'advanced', label: 'Advanced' },
              ]}
            />
          </Form.Item>

          <div
            style={{
              marginBottom: '24px',
              background: '#fafafa',
              padding: '16px',
              borderRadius: '8px',
            }}
          >
            <Text
              strong
              style={{
                fontSize: '16px',
                display: 'block',
                marginBottom: '16px',
              }}
            >
              Weekly Schedules
            </Text>

            <Form.List name='schedules'>
              {(fields, { add, remove }) => {
                const schedules = form.getFieldValue('schedules') || [];
                return (
                  <>
                    {fields.map(({ key, name, ...restField }) => {
                      const schedule = schedules[name];
                      const rowKey = schedule?.temp_id || key;
                      return (
                        <Row
                          key={rowKey}
                          gutter={16}
                          align='middle'
                          style={{ marginBottom: 12 }}
                        >
                          <Form.Item
                            {...restField}
                            name={[name, 'temp_id']}
                            hidden
                            style={{ display: 'none' }}
                          >
                            <Input />
                          </Form.Item>
                          <Col xs={24} sm={6}>
                            <Form.Item
                              {...restField}
                              name={[name, 'day']}
                              rules={[{ required: true, message: 'Required' }]}
                              style={{ marginBottom: 0 }}
                            >
                              <Select placeholder='Day'>
                                {[
                                  'Monday',
                                  'Tuesday',
                                  'Wednesday',
                                  'Thursday',
                                  'Friday',
                                  'Saturday',
                                  'Sunday',
                                ].map((day) => (
                                  <Option key={day} value={day}>
                                    {day}
                                  </Option>
                                ))}
                              </Select>
                            </Form.Item>
                          </Col>
                          <Col xs={24} sm={8}>
                            <Form.Item
                              {...restField}
                              name={[name, 'time']}
                              rules={[{ required: true, message: 'Required' }]}
                              style={{ marginBottom: 0 }}
                            >
                              <TimePicker.RangePicker
                                format='HH:mm'
                                style={{ width: '100%' }}
                                minuteStep={15}
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={22} sm={8}>
                            <Form.Item
                              {...restField}
                              name={[name, 'court_id']}
                              rules={[{ required: true, message: 'Required' }]}
                              style={{ marginBottom: 0 }}
                            >
                              <Select
                                placeholder='Select Location'
                                popupRender={(menu) => (
                                  <>
                                    {menu}
                                    <Divider style={{ margin: '8px 0' }} />
                                    <Button
                                      type='text'
                                      block
                                      icon={<PlusOutlined />}
                                      onClick={() => {
                                        setIsLocationModalOpen(true);
                                        setActiveScheduleIndex(name);
                                      }}
                                    >
                                      Create New Location
                                    </Button>
                                  </>
                                )}
                              >
                                {courts.map((court, index) => (
                                  <Option
                                    key={court.id || court._id || `court-${index}`}
                                    value={court.id || court._id || ''}
                                  >
                                    {court.name}
                                  </Option>
                                ))}
                              </Select>
                            </Form.Item>
                          </Col>
                          <Col xs={2} sm={2}>
                            <Button
                              type='text'
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => remove(name)}
                            />
                          </Col>
                        </Row>
                      );
                    })}
                    <Form.Item>
                      <Button
                        type='dashed'
                        onClick={() => add({ temp_id: Date.now().toString() })}
                        block
                        icon={<PlusOutlined />}
                      >
                        Add Schedule
                      </Button>
                    </Form.Item>
                  </>
                );
              }}
            </Form.List>
          </div>

          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => router.back()}>Cancel</Button>
              <Button
                type='primary'
                htmlType='submit'
                loading={loading}
                size='large'
              >
                Update Club
              </Button>
            </Space>
          </div>
        </Form>
      </Card>

      {/* Create Location Modal */}
      <Modal
        title='Create New Location'
        open={isLocationModalOpen}
        onOk={handleCreateLocationSubmit}
        onCancel={() => setIsLocationModalOpen(false)}
        okText='Create Location'
      >
        <Form form={locationForm} layout='vertical'>
          <Form.Item
            name='name'
            label='Location Name'
            rules={[{ required: true, message: 'Please enter location name' }]}
          >
            <Input placeholder='e.g. Metro Sports Center' />
          </Form.Item>

          <Form.Item
            name='address'
            label='Address'
            rules={[
              {
                required: true,
                message: 'Please search and select an address',
              },
            ]}
            extra='If the specific place name is not found, try searching by street address (e.g., A.C. Cortes Ave).'
          >
            <AutoComplete
              onSearch={handleLocationSearch}
              onSelect={handleLocationSelect}
              options={locationOptions}
              placeholder='Search address (Cebu/PH)'
            />
          </Form.Item>

          {selectedCoordinates && (
            <div style={{ marginTop: 16 }}>
              <LocationMap
                lat={selectedCoordinates.lat}
                lon={selectedCoordinates.lon}
                onPositionChange={(lat, lon) =>
                  setSelectedCoordinates({ lat, lon })
                }
              />
              <Text
                type='secondary'
                style={{ fontSize: '12px', display: 'block', marginTop: '8px' }}
              >
                Drag the marker or click on the map to adjust the location.
              </Text>
            </div>
          )}
        </Form>
      </Modal>
    </div>
  );
}

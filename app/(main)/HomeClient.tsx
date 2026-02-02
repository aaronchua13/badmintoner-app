'use client';

import { Typography, Card, Row, Col } from 'antd';
import { TeamOutlined, CalendarOutlined, UnorderedListOutlined } from '@ant-design/icons';
import Link from 'next/link';

const { Title, Paragraph } = Typography;

export default function HomeClient() {
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <Title level={1}>Welcome to Badmintoner</Title>
          <Paragraph style={{ fontSize: '18px' }}>
            Your ultimate platform for badminton club management and events
          </Paragraph>
        </div>

        <Row gutter={[24, 24]}>
          <Col xs={24} md={8}>
            <Link href="/queuing" style={{ textDecoration: 'none' }}>
              <Card hoverable style={{ height: '100%' }}>
                <div style={{ textAlign: 'center' }}>
                  <UnorderedListOutlined style={{ fontSize: '48px', color: '#722ed1', marginBottom: '16px' }} />
                  <Title level={3}>Queuing</Title>
                  <Paragraph>
                    Manage sessions, courts, and player queues efficiently
                  </Paragraph>
                </div>
              </Card>
            </Link>
          </Col>
          <Col xs={24} md={8}>
            <Link href="/clubs" style={{ textDecoration: 'none' }}>
              <Card hoverable style={{ height: '100%' }}>
                <div style={{ textAlign: 'center' }}>
                  <TeamOutlined style={{ fontSize: '48px', color: '#52c41a', marginBottom: '16px' }} />
                  <Title level={3}>Clubs</Title>
                  <Paragraph>
                    Connect with badminton clubs in your area
                  </Paragraph>
                </div>
              </Card>
            </Link>
          </Col>
          <Col xs={24} md={8}>
            <Link href="/events" style={{ textDecoration: 'none' }}>
              <Card hoverable style={{ height: '100%' }}>
                <div style={{ textAlign: 'center' }}>
                  <CalendarOutlined style={{ fontSize: '48px', color: '#fa8c16', marginBottom: '16px' }} />
                  <Title level={3}>Events</Title>
                  <Paragraph>
                    Find and join upcoming tournaments and matches
                  </Paragraph>
                </div>
              </Card>
            </Link>
          </Col>
        </Row>
      </div>
  );
}

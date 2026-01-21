import MainLayout from '@/layouts/MainLayout';
import { Typography, Card, Row, Col } from 'antd';
import { TrophyOutlined, TeamOutlined, CalendarOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

export default function Home() {
  return (
    <MainLayout>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <Title level={1}>Welcome to Badmintoner</Title>
          <Paragraph style={{ fontSize: '18px' }}>
            Your ultimate platform for badminton club management and events
          </Paragraph>
        </div>

        <Row gutter={[24, 24]}>
          <Col xs={24} md={8}>
            <Card hoverable>
              <div style={{ textAlign: 'center' }}>
                <TrophyOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
                <Title level={3}>Players</Title>
                <Paragraph>
                  Manage player profiles, rankings, and statistics
                </Paragraph>
              </div>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card hoverable>
              <div style={{ textAlign: 'center' }}>
                <TeamOutlined style={{ fontSize: '48px', color: '#52c41a', marginBottom: '16px' }} />
                <Title level={3}>Clubs</Title>
                <Paragraph>
                  Connect with badminton clubs in your area
                </Paragraph>
              </div>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card hoverable>
              <div style={{ textAlign: 'center' }}>
                <CalendarOutlined style={{ fontSize: '48px', color: '#fa8c16', marginBottom: '16px' }} />
                <Title level={3}>Events</Title>
                <Paragraph>
                  Find and join upcoming tournaments and matches
                </Paragraph>
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    </MainLayout>
  );
}

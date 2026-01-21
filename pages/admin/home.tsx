import AdminLayout from '@/layouts/AdminLayout';
import { Typography, Card, Row, Col, Statistic } from 'antd';
import { UserOutlined, TeamOutlined, CalendarOutlined, TrophyOutlined } from '@ant-design/icons';

const { Title } = Typography;

export default function AdminHome() {
  return (
    <AdminLayout>
      <Title level={2}>Dashboard</Title>
      <Row gutter={[16, 16]} style={{ marginTop: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Users"
              value={0}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Clubs"
              value={0}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Events"
              value={0}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Players"
              value={0}
              prefix={<TrophyOutlined />}
              valueStyle={{ color: '#eb2f96' }}
            />
          </Card>
        </Col>
      </Row>
      <Card style={{ marginTop: '24px' }}>
        <Title level={4}>Welcome to the Admin Dashboard</Title>
        <p>This is your central hub for managing the Badmintoner platform. Use the sidebar to navigate to different sections.</p>
      </Card>
    </AdminLayout>
  );
}

'use client';

import { Typography, Card } from 'antd';
import { TeamOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

export default function ClubPage() {
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <Card>
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <TeamOutlined style={{ fontSize: '72px', color: '#1890ff', marginBottom: '24px' }} />
          <Title level={2}>Club Page</Title>
          <Paragraph style={{ fontSize: '16px', color: '#666' }}>
            Coming soon! This page will display badminton clubs and their information.
          </Paragraph>
        </div>
      </Card>
    </div>
  );
}

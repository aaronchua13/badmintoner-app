import AdminLayout from '@/layouts/AdminLayout';
import { Typography, Card, Table, Button, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';

const { Title } = Typography;

export default function AdminClubs() {
  const columns: any[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: 'Club Name',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      width: 200,
    },
    {
      title: 'Members',
      dataIndex: 'members',
      key: 'members',
      width: 120,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      render: () => (
        <Space>
          <Button type="link" icon={<EditOutlined />}>Edit</Button>
          <Button type="link" danger icon={<DeleteOutlined />}>Delete</Button>
        </Space>
      ),
    },
  ];

  return (
    <AdminLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Title level={2} style={{ margin: 0 }}>Clubs Management</Title>
        <Button type="primary" icon={<PlusOutlined />}>Add Club</Button>
      </div>
      <Card
        bordered={false} 
        style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
        bodyStyle={{ padding: '0' }}
      >
        <Table
          columns={columns}
          dataSource={[]}
          locale={{ emptyText: 'No clubs yet. Add your first club!' }}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 800 }}
        />
      </Card>
    </AdminLayout>
  );
}

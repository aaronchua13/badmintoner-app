import AdminLayout from '@/layouts/AdminLayout';
import { Typography, Card, Table, Button, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';

const { Title } = Typography;

export default function AdminClubs() {
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: 'Club Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
    },
    {
      title: 'Members',
      dataIndex: 'members',
      key: 'members',
    },
    {
      title: 'Actions',
      key: 'actions',
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
      <Card>
        <Table
          columns={columns}
          dataSource={[]}
          locale={{ emptyText: 'No clubs yet. Add your first club!' }}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </AdminLayout>
  );
}

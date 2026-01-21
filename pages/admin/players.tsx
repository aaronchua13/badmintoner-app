import AdminLayout from '@/layouts/AdminLayout';
import { Typography, Card, Table, Button, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';

const { Title } = Typography;

export default function AdminPlayers() {
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: 'Player Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Club',
      dataIndex: 'club',
      key: 'club',
    },
    {
      title: 'Ranking',
      dataIndex: 'ranking',
      key: 'ranking',
    },
    {
      title: 'Matches Played',
      dataIndex: 'matches',
      key: 'matches',
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
        <Title level={2} style={{ margin: 0 }}>Players Management</Title>
        <Button type="primary" icon={<PlusOutlined />}>Add Player</Button>
      </div>
      <Card>
        <Table
          columns={columns}
          dataSource={[]}
          locale={{ emptyText: 'No players yet. Add your first player!' }}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </AdminLayout>
  );
}

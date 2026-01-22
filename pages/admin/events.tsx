import AdminLayout from '@/layouts/AdminLayout';
import { Typography, Card, Table, Button, Space, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';

const { Title } = Typography;

interface Event {
  id: string;
  name: string;
  date: string;
  location: string;
  status: 'upcoming' | 'ongoing' | 'completed';
}

export default function AdminEvents() {
  const columns: ColumnsType<Event> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: 'Event Name',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 150,
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      width: 200,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => {
        const color = status === 'upcoming' ? 'green' : status === 'ongoing' ? 'blue' : 'default';
        return <Tag color={color}>{status?.toUpperCase()}</Tag>;
      },
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
        <Title level={2} style={{ margin: 0 }}>Events Management</Title>
        <Button type="primary" icon={<PlusOutlined />}>Add Event</Button>
      </div>
      <Card
        bordered={false} 
        style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
        bodyStyle={{ padding: '0' }}
      >
        <Table
          columns={columns}
          dataSource={[]}
          locale={{ emptyText: 'No events yet. Add your first event!' }}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 900 }}
        />
      </Card>
    </AdminLayout>
  );
}

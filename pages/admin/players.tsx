import AdminLayout from '@/layouts/AdminLayout';
import { Typography, Card, Table, Button, Space, Modal, Form, Input, Popconfirm, App, Tag, Avatar } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/utils/api';

const { Title } = Typography;

interface Player {
  _id: string;
  first_name: string;
  last_name: string;
  email: string;
  username?: string;
  role: string;
  image?: string;
  clubs?: string[];
}

interface PlayerFormValues {
  first_name: string;
  last_name: string;
  email: string;
  username?: string;
  password?: string;
}

export default function AdminPlayers() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [form] = Form.useForm();

  // Fetch Players (Users with role 'player')
  const { data: players = [], isLoading } = useQuery({
    queryKey: ['users', 'players'], // specific key for players
    queryFn: async () => {
      const token = localStorage.getItem('token');
      // Fetch from internal API
      return api.get<Player[]>('/players', token || undefined);
    },
  });

  // Create Player Mutation
  const createMutation = useMutation({
    mutationFn: async (values: PlayerFormValues) => {
      const token = localStorage.getItem('token');
      // Using signup endpoint for creation
      return api.post('/players/signup', values, token || undefined);
    },
    onSuccess: () => {
      message.success('Player created successfully');
      handleModalCancel();
      queryClient.invalidateQueries({ queryKey: ['users', 'players'] });
    },
    onError: (error: any) => {
      message.error(error.message || 'Failed to create player');
    },
  });

  // Update Player Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<PlayerFormValues> }) => {
      const token = localStorage.getItem('token');
      return api.patch(`/players/${id}`, values, token || undefined);
    },
    onSuccess: () => {
      message.success('Player updated successfully');
      handleModalCancel();
      queryClient.invalidateQueries({ queryKey: ['users', 'players'] });
    },
    onError: (error: any) => {
      message.error(error.message || 'Failed to update player');
    },
  });

  // Delete Player Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = localStorage.getItem('token');
      return api.delete(`/players/${id}`, token || undefined);
    },
    onSuccess: () => {
      message.success('Player deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['users', 'players'] });
    },
    onError: (error: any) => {
      message.error(error.message || 'Failed to delete player');
    },
  });

  const handleAdd = () => {
    setEditingPlayer(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEdit = (player: Player) => {
    setEditingPlayer(player);
    form.setFieldsValue({
      first_name: player.first_name,
      last_name: player.last_name,
      email: player.email,
      username: player.username,
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleModalOk = () => {
    form.validateFields().then((values) => {
      if (editingPlayer) {
        // For update, exclude password if empty
        const updateData: any = { ...values };
        if (!updateData.password) {
          delete updateData.password;
        }
        updateMutation.mutate({ id: editingPlayer._id, values: updateData });
      } else {
        createMutation.mutate(values);
      }
    });
  };

  const handleModalCancel = () => {
    setIsModalOpen(false);
    setEditingPlayer(null);
    form.resetFields();
  };

  const columns: ColumnsType<Player> = [
    {
      title: 'First Name',
      key: 'first_name',
      width: 150,
      render: (_: any, record: Player) => (
        <Space>
          <Avatar icon={<UserOutlined />} src={record.image} />
          <span>{record.first_name}</span>
        </Space>
      ),
    },
    {
      title: 'Last Name',
      dataIndex: 'last_name',
      key: 'last_name',
      width: 150,
    },
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      width: 150,
      render: (text: string) => text || <Typography.Text type="secondary">-</Typography.Text>,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 250,
    },
    {
      title: 'Clubs',
      dataIndex: 'clubs',
      key: 'clubs',
      width: 200,
      render: (clubs: string[]) => (
        clubs && clubs.length > 0 ? (
          <Space size={[0, 8]} wrap>
            {clubs.map((club) => (
              <Tag key={club}>{club}</Tag>
            ))}
          </Space>
        ) : <Typography.Text type="secondary">-</Typography.Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_: unknown, record: Player) => (
        <Space>
          <Button 
            type="link" 
            icon={<EditOutlined />} 
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete Player"
            description="Are you sure to delete this player?"
            onConfirm={() => handleDelete(record._id)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <AdminLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Title level={2} style={{ margin: 0 }}>Players Management</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>Add Player</Button>
      </div>
      <Card
        bordered={false} 
        style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
        bodyStyle={{ padding: '0' }}
      >
        <Table
          loading={isLoading}
          columns={columns}
          dataSource={players}
          rowKey="_id"
          locale={{ emptyText: 'No players yet. Add your first player!' }}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 900 }}
        />
      </Card>

      <Modal
        title={editingPlayer ? 'Edit Player' : 'Add Player'}
        open={isModalOpen}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form
          form={form}
          layout="vertical"
          name="playerForm"
        >
          <Form.Item
            name="first_name"
            label="First Name"
            rules={[{ required: true, message: 'Please input first name!' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="last_name"
            label="Last Name"
            rules={[{ required: true, message: 'Please input last name!' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="username"
            label="Username"
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please input email!' },
              { type: 'email', message: 'Please enter a valid email!' }
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="password"
            label={editingPlayer ? 'Password (leave blank to keep current)' : 'Password'}
            rules={[{ required: !editingPlayer, message: 'Please input password!' }]}
          >
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </AdminLayout>
  );
}

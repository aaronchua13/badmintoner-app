'use client';

import { Typography, Card, Table, Button, Space, Modal, Form, Input, Popconfirm, App, Avatar } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPlayerAction, updatePlayerAction, deletePlayerAction } from '@/app/actions/admin';

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
  [key: string]: unknown;
}

export default function PlayersClient({ initialPlayers }: { initialPlayers: Player[] }) {
  const { message } = App.useApp();
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleAdd = () => {
    setEditingPlayer(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEdit = (player: Player) => {
    setEditingPlayer(player);
    form.setFieldsValue(player);
    setIsModalOpen(true);
  };

  const handleModalOk = async () => {
    try {
        const values = await form.validateFields();
        setLoading(true);
        
        let result;
        if (editingPlayer) {
            result = await updatePlayerAction(editingPlayer._id, values);
        } else {
            result = await createPlayerAction(values);
        }

        if (result.error) {
            message.error(result.error);
        } else {
            message.success(`Player ${editingPlayer ? 'updated' : 'created'} successfully`);
            setIsModalOpen(false);
            form.resetFields();
            router.refresh();
        }
    } catch {
        // Form validation error
    } finally {
        setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
      const result = await deletePlayerAction(id);
      if (result.error) {
          message.error(result.error);
      } else {
          message.success('Player deleted successfully');
          router.refresh();
      }
  };

  const columns: ColumnsType<Player> = [
    {
      title: 'Avatar',
      key: 'avatar',
      width: 80,
      render: (_, record) => <Avatar src={record.image} icon={<UserOutlined />} />,
    },
    {
      title: 'Name',
      key: 'name',
      render: (_, record) => `${record.first_name} ${record.last_name}`,
    },
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Clubs',
      dataIndex: 'clubs',
      key: 'clubs',
      render: (clubs: string[]) => clubs?.length || 0,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>Edit</Button>
          <Popconfirm title="Are you sure?" onConfirm={() => handleDelete(record._id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Title level={2} style={{ margin: 0 }}>Players Management</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>Add Player</Button>
      </div>
      <Card
        variant="borderless" 
        style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
        styles={{ body: { padding: '0' } }}
      >
        <Table
          columns={columns}
          dataSource={initialPlayers}
          rowKey="_id"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 900 }}
        />
      </Card>

      <Modal
        title={editingPlayer ? 'Edit Player' : 'Add Player'}
        open={isModalOpen}
        onOk={handleModalOk}
        onCancel={() => setIsModalOpen(false)}
        confirmLoading={loading}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="first_name" label="First Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="last_name" label="Last Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="username" label="Username">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          {!editingPlayer && (
            <Form.Item name="password" label="Password" rules={[{ required: true }]}>
              <Input.Password />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  );
}

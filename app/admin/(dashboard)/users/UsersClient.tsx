'use client';

import { Typography, Card, Table, Button, Space, Modal, Form, Input, Select, Popconfirm, App, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUserAction, updateUserAction, deleteUserAction } from '@/app/actions/admin';

const { Title } = Typography;
const { Option } = Select;

interface User {
  _id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  [key: string]: unknown;
}

export default function UsersClient({ initialUsers }: { initialUsers: User[] }) {
  const { message } = App.useApp();
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleAdd = () => {
    setEditingUser(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    form.setFieldsValue(user);
    setIsModalOpen(true);
  };

  const handleModalOk = async () => {
    try {
        const values = await form.validateFields();
        setLoading(true);
        
        let result;
        if (editingUser) {
            result = await updateUserAction(editingUser._id, values);
        } else {
            result = await createUserAction(values);
        }

        if (result.error) {
            message.error(result.error);
        } else {
            message.success(`User ${editingUser ? 'updated' : 'created'} successfully`);
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
      const result = await deleteUserAction(id);
      if (result.error) {
          message.error(result.error);
      } else {
          message.success('User deleted successfully');
          router.refresh();
      }
  };

  const columns: ColumnsType<User> = [
    {
      title: 'Name',
      key: 'name',
      render: (_, record) => `${record.first_name} ${record.last_name}`,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => (
        <Tag color={role === 'admin' ? 'blue' : 'green'}>
          {role.toUpperCase()}
        </Tag>
      ),
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
        <Title level={2} style={{ margin: 0 }}>Users Management</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>Add User</Button>
      </div>
      <Card
        variant="borderless" 
        style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
        styles={{ body: { padding: '0' } }}
      >
        <Table
          columns={columns}
          dataSource={initialUsers}
          rowKey="_id"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 800 }}
        />
      </Card>

      <Modal
        title={editingUser ? 'Edit User' : 'Add User'}
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
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          {!editingUser && (
            <Form.Item name="password" label="Password" rules={[{ required: true }]}>
              <Input.Password />
            </Form.Item>
          )}
          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select>
              <Option value="admin">Admin</Option>
              <Option value="player">Player</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

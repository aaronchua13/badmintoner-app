import AdminLayout from '@/layouts/AdminLayout';
import { Typography, Card, Table, Button, Space, Modal, Form, Input, Select, Popconfirm, App, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/utils/api';

const { Title } = Typography;
const { Option } = Select;

interface User {
  _id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

interface UserFormValues {
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  password?: string;
}

export default function AdminUsers() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form] = Form.useForm();

  // Fetch Users
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      return api.get<User[]>('/users', token || undefined);
    },
  });

  // Create User Mutation
  const createMutation = useMutation({
    mutationFn: async (values: UserFormValues) => {
      const token = localStorage.getItem('token');
      return api.post('/users', values, token || undefined);
    },
    onSuccess: () => {
      message.success('User created successfully');
      setIsModalOpen(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: Error) => {
      message.error(error.message || 'Failed to create user');
    },
  });

  // Update User Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<UserFormValues> }) => {
      const token = localStorage.getItem('token');
      return api.patch(`/users/${id}`, values, token || undefined);
    },
    onSuccess: () => {
      message.success('User updated successfully');
      setIsModalOpen(false);
      setEditingUser(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: Error) => {
      message.error(error.message || 'Failed to update user');
    },
  });

  // Delete User Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = localStorage.getItem('token');
      return api.delete(`/users/${id}`, token || undefined);
    },
    onSuccess: () => {
      message.success('User deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: Error) => {
      message.error(error.message || 'Failed to delete user');
    },
  });

  const handleAdd = () => {
    setEditingUser(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    form.setFieldsValue({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role: user.role,
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleModalOk = () => {
    form.validateFields().then((values) => {
      if (editingUser) {
        // For update, we might not send password if it's empty
        const updateData: Partial<UserFormValues> = { ...values };
        if (!updateData.password) {
          delete updateData.password;
        }
        updateMutation.mutate({ id: editingUser._id, values: updateData });
      } else {
        createMutation.mutate(values);
      }
    });
  };

  const handleModalCancel = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    form.resetFields();
  };

  const columns: ColumnsType<User> = [
    {
      title: 'First Name',
      dataIndex: 'first_name',
      key: 'first_name',
      width: 150,
    },
    {
      title: 'Last Name',
      dataIndex: 'last_name',
      key: 'last_name',
      width: 150,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 250,
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role: string) => (
        <Tag color={role === 'admin' ? 'blue' : 'green'}>
          {role ? role.toUpperCase() : 'USER'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: User) => (
        <Space>
          <Button 
            type="link" 
            icon={<EditOutlined />} 
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete User"
            description="Are you sure to delete this user?"
            onConfirm={() => handleDelete(record._id)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <AdminLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Title level={2} style={{ margin: 0 }}>Users Management</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          Add User
        </Button>
      </div>

      <Card 
        bordered={false} 
        style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
        bodyStyle={{ padding: '0' }}
      >
        <Table
          loading={isLoading}
          columns={columns}
          dataSource={users}
          rowKey="_id"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 900 }}
        />
      </Card>

      <Modal
        title={editingUser ? 'Edit User' : 'Add User'}
        open={isModalOpen}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form
          form={form}
          layout="vertical"
          name="userForm"
          initialValues={{ role: 'Admin' }}
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
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please input email!' },
              { type: 'email', message: 'Please enter a valid email!' },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="role"
            label="Role"
            rules={[{ required: true, message: 'Please select a role!' }]}
          >
            <Select>
              <Option value="admin">Admin</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="password"
            label={editingUser ? 'Password (leave blank to keep current)' : 'Password'}
            rules={[{ required: !editingUser, message: 'Please input password!' }]}
          >
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </AdminLayout>
  );
}

'use client';

import { Typography, Card, Table, Button, Space, App, Modal, Form, Input, Popconfirm } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClubAction, updateClubAction, deleteClubAction } from '@/app/actions/admin';

const { Title } = Typography;

interface Club {
  _id: string;
  name: string;
  location: string;
  members: number;
  [key: string]: unknown;
}

export default function ClubsClient({ initialClubs }: { initialClubs: Club[] }) {
  const { message } = App.useApp();
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClub, setEditingClub] = useState<Club | null>(null);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleAdd = () => {
    setEditingClub(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEdit = (club: Club) => {
    setEditingClub(club);
    form.setFieldsValue(club);
    setIsModalOpen(true);
  };

  const handleModalOk = async () => {
    try {
        const values = await form.validateFields();
        setLoading(true);
        
        let result;
        if (editingClub) {
            result = await updateClubAction(editingClub._id, values);
        } else {
            result = await createClubAction(values);
        }

        if (result.error) {
            message.error(result.error);
        } else {
            message.success(`Club ${editingClub ? 'updated' : 'created'} successfully`);
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
      const result = await deleteClubAction(id);
      if (result.error) {
          message.error(result.error);
      } else {
          message.success('Club deleted successfully');
          router.refresh();
      }
  };

  const columns: ColumnsType<Club> = [
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
      render: (members: number) => typeof members === 'number' ? members : 0,
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
        <Title level={2} style={{ margin: 0 }}>Clubs Management</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>Add Club</Button>
      </div>
      <Card
        variant="borderless" 
        style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
        bodyStyle={{ padding: '0' }}
      >
        <Table
          columns={columns}
          dataSource={initialClubs}
          rowKey="_id"
          locale={{ emptyText: 'No clubs yet. Add your first club!' }}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 800 }}
        />
      </Card>

      <Modal
        title={editingClub ? 'Edit Club' : 'Add Club'}
        open={isModalOpen}
        onOk={handleModalOk}
        onCancel={() => setIsModalOpen(false)}
        confirmLoading={loading}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Club Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="location" label="Location" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

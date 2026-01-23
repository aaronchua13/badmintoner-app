'use client';

import { Typography, Card, Table, Button, Space, App, Modal, Form, Input, Popconfirm, Tag, DatePicker, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createEventAction, updateEventAction, deleteEventAction } from '@/app/actions/admin';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;

interface Event {
  _id: string;
  name: string;
  date: string;
  location: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  [key: string]: unknown;
}

export default function EventsClient({ initialEvents }: { initialEvents: Event[] }) {
  const { message } = App.useApp();
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleAdd = () => {
    setEditingEvent(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    form.setFieldsValue({
        ...event,
        date: event.date ? dayjs(event.date) : null
    });
    setIsModalOpen(true);
  };

  const handleModalOk = async () => {
    try {
        const values = await form.validateFields();
        setLoading(true);
        
        // Convert date to string
        if (values.date) {
            values.date = values.date.toISOString();
        }

        let result;
        if (editingEvent) {
            result = await updateEventAction(editingEvent._id, values);
        } else {
            result = await createEventAction(values);
        }

        if (result.error) {
            message.error(result.error);
        } else {
            message.success(`Event ${editingEvent ? 'updated' : 'created'} successfully`);
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
      const result = await deleteEventAction(id);
      if (result.error) {
          message.error(result.error);
      } else {
          message.success('Event deleted successfully');
          router.refresh();
      }
  };

  const columns: ColumnsType<Event> = [
    {
      title: 'Event Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const color = status === 'upcoming' ? 'green' : status === 'ongoing' ? 'blue' : 'default';
        return <Tag color={color}>{status?.toUpperCase()}</Tag>;
      },
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
        <Title level={2} style={{ margin: 0 }}>Events Management</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>Add Event</Button>
      </div>
      <Card
        variant="borderless" 
        style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
        bodyStyle={{ padding: '0' }}
      >
        <Table
          columns={columns}
          dataSource={initialEvents}
          rowKey="_id"
          locale={{ emptyText: 'No events yet. Add your first event!' }}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 900 }}
        />
      </Card>

      <Modal
        title={editingEvent ? 'Edit Event' : 'Add Event'}
        open={isModalOpen}
        onOk={handleModalOk}
        onCancel={() => setIsModalOpen(false)}
        confirmLoading={loading}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Event Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="date" label="Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="location" label="Location" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="status" label="Status" rules={[{ required: true }]}>
            <Select>
                <Option value="upcoming">Upcoming</Option>
                <Option value="ongoing">Ongoing</Option>
                <Option value="completed">Completed</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

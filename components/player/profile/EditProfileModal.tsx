import React, { useEffect } from 'react';
import { Modal, Form, Input, Row, Col, Button } from 'antd';
import { UserOutlined } from '@ant-design/icons';

const { TextArea } = Input;

interface EditProfileValues {
  first_name: string;
  last_name: string;
  username: string;
  bio?: string;
}

interface EditProfileModalProps {
  open: boolean;
  onCancel: () => void;
  onFinish: (values: EditProfileValues) => Promise<void>;
  loading: boolean;
  initialValues: {
    first_name?: string;
    last_name?: string;
    username?: string;
    bio?: string;
  };
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  open,
  onCancel,
  onFinish,
  loading,
  initialValues,
}) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      form.setFieldsValue(initialValues);
    }
  }, [open, initialValues, form]);

  const handleSubmit = async (values: EditProfileValues) => {
    await onFinish(values);
  };

  return (
    <Modal
      title="Edit Profile"
      open={open}
      onCancel={onCancel}
      footer={null}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="First Name"
              name="first_name"
              rules={[{ required: true, message: 'Please input your first name!' }]}
            >
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Last Name"
              name="last_name"
              rules={[{ required: true, message: 'Please input your last name!' }]}
            >
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          label="Username"
          name="username"
          rules={[
            { required: true, message: 'Please input your username!' },
            { pattern: /^[a-zA-Z0-9_]+$/, message: 'Username can only contain letters, numbers and underscores' }
          ]}
        >
          <Input prefix={<UserOutlined />} />
        </Form.Item>

        <Form.Item
          label="Bio"
          name="bio"
        >
          <TextArea rows={4} placeholder="Tell us about yourself..." maxLength={300} showCount />
        </Form.Item>

        <div style={{ textAlign: 'right' }}>
          <Button onClick={onCancel} style={{ marginRight: 8 }}>
            Cancel
          </Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            Save Changes
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

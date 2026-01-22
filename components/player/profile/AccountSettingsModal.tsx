import React, { useEffect } from 'react';
import { Modal, Form, Input, Button } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';

interface AccountSettingsValues {
  email: string;
  password?: string;
}

interface AccountSettingsModalProps {
  open: boolean;
  onCancel: () => void;
  onFinish: (values: AccountSettingsValues) => Promise<void>;
  loading: boolean;
  initialValues: {
    email?: string;
  };
}

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
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
      form.setFieldValue('password', ''); // Reset password field
    }
  }, [open, initialValues, form]);

  const handleSubmit = async (values: AccountSettingsValues) => {
    await onFinish(values);
    form.setFieldValue('password', '');
  };

  return (
    <Modal
      title="Account Settings"
      open={open}
      onCancel={onCancel}
      footer={null}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        <Form.Item
          label="Email Address"
          name="email"
          rules={[
            { type: 'email', message: 'Please enter a valid email!' },
            { required: true, message: 'Email is required' }
          ]}
        >
          <Input prefix={<MailOutlined />} />
        </Form.Item>

        <Form.Item
          label="New Password"
          name="password"
          help="Leave blank if you don't want to change it"
        >
          <Input.Password prefix={<LockOutlined />} placeholder="Enter new password" />
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

'use client';

import { useState, useRef } from 'react';
import { Modal, Form, Input, DatePicker, App, AutoComplete } from 'antd';
import { createEventAction } from '@/app/actions/club-event';
import { useRouter } from 'next/navigation';

interface CreateEventModalProps {
  open: boolean;
  onCancel: () => void;
  userId: string;
}

interface GeoapifyFeature {
    properties: {
        formatted: string;
        place_id: string;
    };
}

export default function CreateEventModal({ open, onCancel, userId }: CreateEventModalProps) {
  const { message } = App.useApp();
  const router = useRouter();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  
  // Geoapify Autocomplete State
  const [addressOptions, setAddressOptions] = useState<{ value: string; label: string; placeId: string }[]>([]);

  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleAddressSearch = (value: string) => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (!value || value.length < 3) return;
    
    searchTimeout.current = setTimeout(async () => {
        const apiKey = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY; 
        
        if (!apiKey) {
            console.error('Geoapify API key is missing. Please check your environment variables.');
            return;
        }
        
        // Limit to Philippines (Cebu province specific filtering requires complex geometry)
        const filter = '&filter=countrycode:ph';

        try {
            const response = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(value)}&apiKey=${apiKey}${filter}`);
            
            if (!response.ok) {
                console.error('Geoapify API error:', response.status, response.statusText);
                return;
            }

            const data = await response.json();
            
            if (data.features) {
                const options = data.features.map((feature: GeoapifyFeature) => ({
                    value: feature.properties.formatted,
                    label: feature.properties.formatted,
                    placeId: feature.properties.place_id,
                }));
                setAddressOptions(options);
            }
        } catch (error) {
            console.error('Error fetching address:', error);
        }
    }, 500);
  };

  const handleSubmit = async () => {
    try {
        const values = await form.validateFields();
        setLoading(true);

        // Find placeId from options if available
        const selectedOption = addressOptions.find(opt => opt.value === values.location);

        const eventData = {
            name: values.name,
            organizer_id: userId,
            date: values.date.toISOString(),
            location: {
                name: values.location,
                place_id: selectedOption?.placeId
            },
            description: values.description
        };

        const result = await createEventAction(eventData);

        if (result.error) {
            message.error(result.error);
        } else {
            message.success('Event created successfully');
            onCancel();
            form.resetFields();
            router.refresh();
        }
    } catch {
        // Validation error
    } finally {
        setLoading(false);
    }
  };

  return (
    <Modal
        title="Create New Event"
        open={open}
        onOk={handleSubmit}
        onCancel={onCancel}
        confirmLoading={loading}
    >
        <Form form={form} layout="vertical">
            <Form.Item name="name" label="Event Name" rules={[{ required: true }]}>
                <Input placeholder="e.g. Summer Tournament" />
            </Form.Item>
            
            <Form.Item name="date" label="Date & Time" rules={[{ required: true }]}>
                <DatePicker showTime style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item name="location" label="Location" rules={[{ required: true }]}>
                 <AutoComplete
                    onSearch={handleAddressSearch}
                    options={addressOptions}
                    placeholder="Search for a location"
                />
            </Form.Item>

            <Form.Item name="description" label="Description">
                <Input.TextArea rows={4} />
            </Form.Item>
        </Form>
    </Modal>
  );
}

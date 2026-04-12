import { useState } from 'react';
import { Table, Typography, Input, Button, Space, message } from 'antd';
import { SaveOutlined, EditOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { SystemConfig } from '@/types';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Title } = Typography;

export default function AdminConfigPage() {
  const queryClient = useQueryClient();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const { data: configs, isLoading } = useQuery({
    queryKey: ['system-configs'],
    queryFn: () => apiClient.get<SystemConfig[]>('/api/v1/system-configs'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; value: string }) =>
      apiClient.patch(`/api/v1/system-configs/${data.id}`, { value: data.value }),
    onSuccess: () => {
      message.success('تم تحديث الإعداد');
      queryClient.invalidateQueries({ queryKey: ['system-configs'] });
      setEditingKey(null);
    },
    onError: (err: Error) => {
      message.error(err.message || 'فشل تحديث الإعداد');
    },
  });

  const startEdit = (config: SystemConfig) => {
    setEditingKey(config.id);
    setEditValue(config.value);
  };

  const saveEdit = (id: string) => {
    updateMutation.mutate({ id, value: editValue });
  };

  const columns: ColumnsType<SystemConfig> = [
    {
      title: 'المفتاح',
      dataIndex: 'key',
      key: 'key',
      width: 220,
    },
    {
      title: 'القيمة',
      dataIndex: 'value',
      key: 'value',
      render: (value: string, record: SystemConfig) => {
        if (editingKey === record.id) {
          return (
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onPressEnter={() => saveEdit(record.id)}
              style={{ width: '100%' }}
            />
          );
        }
        return value;
      },
    },
    {
      title: 'الوصف',
      dataIndex: 'description',
      key: 'description',
      width: 250,
      ellipsis: true,
    },
    {
      title: 'آخر تحديث',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 140,
      render: (date: string) => dayjs(date).format('YYYY/MM/DD HH:mm'),
    },
    {
      title: 'الإجراء',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: SystemConfig) => {
        if (editingKey === record.id) {
          return (
            <Space>
              <Button
                size="small"
                type="primary"
                icon={<SaveOutlined />}
                onClick={() => saveEdit(record.id)}
                loading={updateMutation.isPending}
              >
                حفظ
              </Button>
              <Button size="small" onClick={() => setEditingKey(null)}>
                إلغاء
              </Button>
            </Space>
          );
        }
        return (
          <Button size="small" icon={<EditOutlined />} onClick={() => startEdit(record)}>
            تعديل
          </Button>
        );
      },
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        تهيئة النظام
      </Title>

      <Table
        columns={columns}
        dataSource={Array.isArray(configs) ? configs : []}
        rowKey="id"
        loading={isLoading}
        pagination={false}
      />
    </div>
  );
}

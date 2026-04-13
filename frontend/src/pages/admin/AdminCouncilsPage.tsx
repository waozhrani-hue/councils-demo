import { useState } from 'react';
import {
  Table,
  Button,
  Typography,
  Modal,
  Form,
  Input,
  Switch,
  Space,
  Tag,
  Popconfirm,
  message,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { Council, PaginatedResponse } from '@/types';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Title } = Typography;
const { TextArea } = Input;

export default function AdminCouncilsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCouncil, setEditingCouncil] = useState<Council | null>(null);
  const [form] = Form.useForm();

  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('pageSize', String(pageSize));

  const { data, isLoading } = useQuery({
    queryKey: ['admin-councils'],
    queryFn: () => apiClient.get<Council[]>('/api/v1/councils'),
  });

  const createMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      apiClient.post<Council>('/api/v1/councils', values),
    onSuccess: () => {
      message.success('تم إنشاء المجلس');
      queryClient.invalidateQueries({ queryKey: ['admin-councils'] });
      closeModal();
    },
    onError: (err: Error) => {
      message.error(err.message || 'فشل إنشاء المجلس');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; values: Record<string, unknown> }) =>
      apiClient.patch<Council>(`/api/v1/councils/${data.id}`, data.values),
    onSuccess: () => {
      message.success('تم تحديث المجلس');
      queryClient.invalidateQueries({ queryKey: ['admin-councils'] });
      closeModal();
    },
    onError: (err: Error) => {
      message.error(err.message || 'فشل تحديث المجلس');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/v1/councils/${id}`),
    onSuccess: () => {
      message.success('تم حذف المجلس');
      queryClient.invalidateQueries({ queryKey: ['admin-councils'] });
    },
    onError: (err: Error) => {
      message.error(err.message || 'فشل حذف المجلس');
    },
  });

  const openModal = (council?: Council) => {
    if (council) {
      setEditingCouncil(council);
      form.setFieldsValue({
        name: council.name,
        description: council.description,
        isActive: council.isActive,
      });
    } else {
      setEditingCouncil(null);
      form.resetFields();
      form.setFieldsValue({ isActive: true });
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingCouncil(null);
    form.resetFields();
  };

  const handleSave = () => {
    form.validateFields().then((values) => {
      if (editingCouncil) {
        updateMutation.mutate({ id: editingCouncil.id, values });
      } else {
        createMutation.mutate(values);
      }
    });
  };

  const columns: ColumnsType<Council> = [
    {
      title: 'اسم المجلس',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'الوصف',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'الحالة',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'red'}>{active ? 'نشط' : 'معطل'}</Tag>
      ),
    },
    {
      title: 'تاريخ الإنشاء',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date: string) => dayjs(date).format('YYYY/MM/DD'),
    },
    {
      title: 'الإجراءات',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: Council) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal(record)} />
          <Popconfirm
            title="هل أنت متأكد من حذف هذا المجلس؟"
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="نعم"
            cancelText="لا"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          إدارة المجالس
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          إضافة مجلس
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={Array.isArray(data) ? data : []}
        rowKey="id"
        loading={isLoading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `الإجمالي: ${total}`,
        }}
      />

      <Modal
        title={editingCouncil ? 'تعديل مجلس' : 'إضافة مجلس جديد'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={closeModal}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText="حفظ"
        cancelText="إلغاء"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="اسم المجلس" rules={[{ required: true, message: 'مطلوب' }]}>
            <Input placeholder="أدخل اسم المجلس" />
          </Form.Item>
          <Form.Item name="description" label="الوصف">
            <TextArea rows={3} placeholder="أدخل وصف المجلس" />
          </Form.Item>
          <Form.Item name="isActive" label="نشط" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

import { useState } from 'react';
import {
  Table,
  Button,
  Typography,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Space,
  Tag,
  Popconfirm,
  message,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { OrganizationUnit, PaginatedResponse } from '@/types';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Title } = Typography;

export default function AdminOrgUnitsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<OrganizationUnit | null>(null);
  const [form] = Form.useForm();

  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('pageSize', String(pageSize));

  const { data, isLoading } = useQuery({
    queryKey: ['admin-org-units', page, pageSize],
    queryFn: () =>
      apiClient.get<PaginatedResponse<OrganizationUnit>>(
        `/api/v1/org-units?${queryParams.toString()}`,
      ),
  });

  const { data: allUnits } = useQuery({
    queryKey: ['org-units'],
    queryFn: () => apiClient.get<OrganizationUnit[]>('/api/v1/org-units'),
  });

  const createMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      apiClient.post<OrganizationUnit>('/api/v1/org-units', values),
    onSuccess: () => {
      message.success('تم إنشاء الوحدة');
      queryClient.invalidateQueries({ queryKey: ['admin-org-units'] });
      queryClient.invalidateQueries({ queryKey: ['org-units'] });
      closeModal();
    },
    onError: (err: Error) => {
      message.error(err.message || 'فشل إنشاء الوحدة');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; values: Record<string, unknown> }) =>
      apiClient.patch<OrganizationUnit>(`/api/v1/org-units/${data.id}`, data.values),
    onSuccess: () => {
      message.success('تم تحديث الوحدة');
      queryClient.invalidateQueries({ queryKey: ['admin-org-units'] });
      queryClient.invalidateQueries({ queryKey: ['org-units'] });
      closeModal();
    },
    onError: (err: Error) => {
      message.error(err.message || 'فشل تحديث الوحدة');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/v1/org-units/${id}`),
    onSuccess: () => {
      message.success('تم حذف الوحدة');
      queryClient.invalidateQueries({ queryKey: ['admin-org-units'] });
      queryClient.invalidateQueries({ queryKey: ['org-units'] });
    },
    onError: (err: Error) => {
      message.error(err.message || 'فشل حذف الوحدة');
    },
  });

  const openModal = (unit?: OrganizationUnit) => {
    if (unit) {
      setEditingUnit(unit);
      form.setFieldsValue({
        name: unit.name,
        parentId: unit.parentId,
        isActive: unit.isActive,
      });
    } else {
      setEditingUnit(null);
      form.resetFields();
      form.setFieldsValue({ isActive: true });
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingUnit(null);
    form.resetFields();
  };

  const handleSave = () => {
    form.validateFields().then((values) => {
      if (editingUnit) {
        updateMutation.mutate({ id: editingUnit.id, values });
      } else {
        createMutation.mutate(values);
      }
    });
  };

  const columns: ColumnsType<OrganizationUnit> = [
    {
      title: 'اسم الوحدة',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'الوحدة الأم',
      dataIndex: ['parent', 'name'],
      key: 'parent',
      width: 180,
      render: (text: string) => text || '-',
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
      render: (_: unknown, record: OrganizationUnit) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal(record)} />
          <Popconfirm
            title="هل أنت متأكد من حذف هذه الوحدة؟"
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
          إدارة الوحدات التنظيمية
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          إضافة وحدة
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={data?.data || []}
        rowKey="id"
        loading={isLoading}
        pagination={{
          current: page,
          pageSize,
          total: data?.total || 0,
          showSizeChanger: true,
          showTotal: (total) => `الإجمالي: ${total}`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      <Modal
        title={editingUnit ? 'تعديل وحدة' : 'إضافة وحدة جديدة'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={closeModal}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText="حفظ"
        cancelText="إلغاء"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="اسم الوحدة" rules={[{ required: true, message: 'مطلوب' }]}>
            <Input placeholder="أدخل اسم الوحدة" />
          </Form.Item>
          <Form.Item name="parentId" label="الوحدة الأم">
            <Select
              placeholder="اختر الوحدة الأم"
              allowClear
              options={(Array.isArray(allUnits) ? allUnits : [])
                .filter((u) => u.id !== editingUnit?.id)
                .map((u) => ({
                  label: u.name,
                  value: u.id,
                }))}
            />
          </Form.Item>
          <Form.Item name="isActive" label="نشط" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

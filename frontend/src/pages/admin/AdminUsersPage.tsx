import { useState } from 'react';
import {
  Table,
  Button,
  Typography,
  Drawer,
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
import type { User, OrganizationUnit, PaginatedResponse } from '@/types';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Title } = Typography;

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form] = Form.useForm();

  const { data: orgUnits } = useQuery({
    queryKey: ['org-units'],
    queryFn: () => apiClient.get<OrganizationUnit[]>('/api/v1/org-units'),
  });

  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('pageSize', String(pageSize));

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, pageSize],
    queryFn: () =>
      apiClient.get<PaginatedResponse<User>>(`/api/v1/users?${queryParams.toString()}`),
  });

  const createMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      apiClient.post<User>('/api/v1/users', values),
    onSuccess: () => {
      message.success('تم إنشاء المستخدم');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      closeDrawer();
    },
    onError: (err: Error) => {
      message.error(err.message || 'فشل إنشاء المستخدم');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; values: Record<string, unknown> }) =>
      apiClient.patch<User>(`/api/v1/users/${data.id}`, data.values),
    onSuccess: () => {
      message.success('تم تحديث المستخدم');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      closeDrawer();
    },
    onError: (err: Error) => {
      message.error(err.message || 'فشل تحديث المستخدم');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/v1/users/${id}`),
    onSuccess: () => {
      message.success('تم حذف المستخدم');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: Error) => {
      message.error(err.message || 'فشل حذف المستخدم');
    },
  });

  const openDrawer = (user?: User) => {
    if (user) {
      setEditingUser(user);
      form.setFieldsValue({
        email: user.email,
        displayName: user.displayName,
        isActive: user.isActive,
        organizationId: user.organizationId,
      });
    } else {
      setEditingUser(null);
      form.resetFields();
      form.setFieldsValue({ isActive: true });
    }
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingUser(null);
    form.resetFields();
  };

  const handleSave = () => {
    form.validateFields().then((values) => {
      if (editingUser) {
        updateMutation.mutate({ id: editingUser.id, values });
      } else {
        createMutation.mutate(values);
      }
    });
  };

  const columns: ColumnsType<User> = [
    {
      title: 'الاسم',
      dataIndex: 'displayName',
      key: 'displayName',
      width: 180,
    },
    {
      title: 'البريد الإلكتروني',
      dataIndex: 'email',
      key: 'email',
      width: 220,
    },
    {
      title: 'الأدوار',
      key: 'roles',
      width: 240,
      render: (_: unknown, record: any) => (
        <Space size={[0, 4]} wrap>
          {record.roles?.map((ur: any) => (
            <Tag key={ur.id} color="blue">
              {ur.role?.labelAr || ur.role?.code}
            </Tag>
          ))}
        </Space>
      ),
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
      render: (_: unknown, record: User) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openDrawer(record)} />
          <Popconfirm
            title="هل أنت متأكد من حذف هذا المستخدم؟"
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
          إدارة المستخدمين
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openDrawer()}>
          إضافة مستخدم
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
        scroll={{ x: 1100 }}
      />

      <Drawer
        title={editingUser ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}
        open={drawerOpen}
        onClose={closeDrawer}
        width={480}
        extra={
          <Space>
            <Button onClick={closeDrawer}>إلغاء</Button>
            <Button
              type="primary"
              onClick={handleSave}
              loading={createMutation.isPending || updateMutation.isPending}
            >
              حفظ
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="displayName"
            label="الاسم"
            rules={[{ required: true, message: 'مطلوب' }]}
          >
            <Input placeholder="أدخل الاسم" />
          </Form.Item>
          <Form.Item
            name="email"
            label="البريد الإلكتروني"
            rules={[
              { required: true, message: 'مطلوب' },
              { type: 'email', message: 'بريد إلكتروني غير صالح' },
            ]}
          >
            <Input placeholder="أدخل البريد الإلكتروني" />
          </Form.Item>
          {!editingUser && (
            <Form.Item
              name="password"
              label="كلمة المرور"
              rules={[{ required: true, message: 'مطلوب' }]}
            >
              <Input.Password placeholder="أدخل كلمة المرور" />
            </Form.Item>
          )}
          <Form.Item name="organizationId" label="الوحدة التنظيمية">
            <Select
              placeholder="اختر الوحدة"
              allowClear
              options={(Array.isArray(orgUnits) ? orgUnits : []).map((o) => ({
                label: o.name,
                value: o.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="isActive" label="نشط" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}

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
  Divider,
  List,
  message,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { User, OrganizationUnit, PaginatedResponse } from '@/types';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface Role {
  id: string;
  code: string;
  nameAr: string;
  scope: string;
}

interface Council {
  id: string;
  name: string;
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [form] = Form.useForm();

  // Role assignment state
  const [selectedRoleId, setSelectedRoleId] = useState<string | undefined>();
  const [selectedCouncilId, setSelectedCouncilId] = useState<string | undefined>();

  const { data: orgUnits } = useQuery({
    queryKey: ['org-units'],
    queryFn: () => apiClient.get<OrganizationUnit[]>('/api/v1/org-units'),
  });

  const { data: allRoles } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => apiClient.get<Role[]>('/api/v1/workflow/roles'),
  });

  const { data: councils } = useQuery({
    queryKey: ['councils'],
    queryFn: () => apiClient.get<Council[]>('/api/v1/councils'),
  });

  const { data: clearanceLevels } = useQuery({
    queryKey: ['clearance-levels'],
    queryFn: () => apiClient.get<any[]>('/api/v1/configs/secret-levels'),
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
    onError: (err: Error) => message.error(err.message || 'فشل إنشاء المستخدم'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; values: Record<string, unknown> }) =>
      apiClient.patch<User>(`/api/v1/users/${data.id}`, data.values),
    onSuccess: () => {
      message.success('تم تحديث المستخدم');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      closeDrawer();
    },
    onError: (err: Error) => message.error(err.message || 'فشل تحديث المستخدم'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/v1/users/${id}`),
    onSuccess: () => {
      message.success('تم حذف المستخدم');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: Error) => message.error(err.message || 'فشل حذف المستخدم'),
  });

  const assignRoleMutation = useMutation({
    mutationFn: (data: { userId: string; roleId: string; councilId?: string }) =>
      apiClient.post(`/api/v1/users/${data.userId}/roles`, {
        roleId: data.roleId,
        councilId: data.councilId,
      }),
    onSuccess: () => {
      message.success('تم إسناد الدور');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      // Refresh user detail
      if (editingUser) {
        refreshEditingUser(editingUser.id);
      }
      setSelectedRoleId(undefined);
      setSelectedCouncilId(undefined);
    },
    onError: (err: Error) => message.error(err.message || 'فشل إسناد الدور'),
  });

  const removeRoleMutation = useMutation({
    mutationFn: (userRoleId: string) =>
      apiClient.delete(`/api/v1/users/roles/${userRoleId}`),
    onSuccess: () => {
      message.success('تم إزالة الدور');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      if (editingUser) {
        refreshEditingUser(editingUser.id);
      }
    },
    onError: (err: Error) => message.error(err.message || 'فشل إزالة الدور'),
  });

  const refreshEditingUser = async (userId: string) => {
    try {
      const user = await apiClient.get<any>(`/api/v1/users/${userId}`);
      setEditingUser(user);
    } catch {
      // ignore
    }
  };

  const openDrawer = (user?: any) => {
    if (user) {
      setEditingUser(user);
      form.setFieldsValue({
        email: user.email,
        displayName: user.displayName,
        isActive: user.isActive,
        organizationId: user.organizationId,
        maxClearanceId: user.maxClearanceId,
      });
    } else {
      setEditingUser(null);
      form.resetFields();
      form.setFieldsValue({ isActive: true });
    }
    setSelectedRoleId(undefined);
    setSelectedCouncilId(undefined);
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

  const handleAssignRole = () => {
    if (!editingUser || !selectedRoleId) return;
    assignRoleMutation.mutate({
      userId: editingUser.id,
      roleId: selectedRoleId,
      councilId: selectedCouncilId,
    });
  };

  // Check if selected role is council-scoped
  const selectedRole = (Array.isArray(allRoles) ? allRoles : []).find((r) => r.id === selectedRoleId);
  const needsCouncil = selectedRole?.scope === 'COUNCIL';

  const roleOptions = (Array.isArray(allRoles) ? allRoles : []).map((r) => ({
    label: `${r.nameAr} (${r.code})`,
    value: r.id,
  }));

  const councilOptions = (Array.isArray(councils) ? councils : []).map((c) => ({
    label: c.name,
    value: c.id,
  }));

  const columns: ColumnsType<User> = [
    { title: 'الاسم', dataIndex: 'displayName', key: 'displayName', width: 180 },
    { title: 'البريد الإلكتروني', dataIndex: 'email', key: 'email', width: 220 },
    {
      title: 'الأدوار',
      key: 'roles',
      width: 280,
      render: (_: unknown, record: any) => (
        <Space size={[0, 4]} wrap>
          {record.roles?.map((ur: any) => (
            <Tag key={ur.id} color="blue">
              {ur.role?.nameAr || ur.role?.code}
              {ur.council ? ` (${ur.council.name})` : ''}
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
        <Title level={4} style={{ margin: 0 }}>إدارة المستخدمين</Title>
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
          total: data?.total || data?.meta?.total || 0,
          showSizeChanger: true,
          showTotal: (total) => `الإجمالي: ${total}`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
        scroll={{ x: 1100 }}
      />

      <Drawer
        title={editingUser ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}
        open={drawerOpen}
        onClose={closeDrawer}
        width={520}
        extra={
          <Space>
            <Button onClick={closeDrawer}>إلغاء</Button>
            <Button type="primary" onClick={handleSave}
              loading={createMutation.isPending || updateMutation.isPending}>
              حفظ
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item name="displayName" label="الاسم" rules={[{ required: true, message: 'مطلوب' }]}>
            <Input placeholder="أدخل الاسم" />
          </Form.Item>
          <Form.Item name="email" label="البريد الإلكتروني"
            rules={[{ required: true, message: 'مطلوب' }, { type: 'email', message: 'بريد إلكتروني غير صالح' }]}>
            <Input placeholder="أدخل البريد الإلكتروني" />
          </Form.Item>
          {!editingUser && (
            <Form.Item name="password" label="كلمة المرور" rules={[{ required: true, message: 'مطلوب' }]}>
              <Input.Password placeholder="أدخل كلمة المرور" />
            </Form.Item>
          )}
          <Form.Item name="organizationId" label="الوحدة التنظيمية">
            <Select placeholder="اختر الوحدة" allowClear showSearch
              filterOption={(input, option) => (option?.label as string)?.includes(input)}
              options={(Array.isArray(orgUnits) ? orgUnits : []).map((o) => ({
                label: o.name,
                value: o.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="maxClearanceId" label="مستوى التصنيف الأمني">
            <Select placeholder="اختر المستوى" allowClear
              options={(Array.isArray(clearanceLevels) ? clearanceLevels : []).map((c: any) => ({
                label: c.name,
                value: c.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="isActive" label="نشط" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>

        {editingUser && (
          <>
            <Divider />
            <Title level={5}>الأدوار المسندة</Title>

            {editingUser.roles && editingUser.roles.length > 0 ? (
              <List
                size="small"
                dataSource={editingUser.roles}
                renderItem={(ur: any) => (
                  <List.Item
                    actions={[
                      <Popconfirm
                        key="remove"
                        title="إزالة هذا الدور؟"
                        onConfirm={() => removeRoleMutation.mutate(ur.id)}
                        okText="نعم"
                        cancelText="لا"
                      >
                        <Button size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>,
                    ]}
                  >
                    <Tag color="blue">{ur.role?.nameAr || ur.role?.code}</Tag>
                    {ur.council && <Text type="secondary"> — {ur.council.name}</Text>}
                  </List.Item>
                )}
              />
            ) : (
              <Text type="secondary">لا توجد أدوار مسندة</Text>
            )}

            <Divider dashed />
            <Title level={5}>إسناد دور جديد</Title>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Select
                placeholder="اختر الدور"
                style={{ width: '100%' }}
                value={selectedRoleId}
                onChange={(val) => { setSelectedRoleId(val); setSelectedCouncilId(undefined); }}
                options={roleOptions}
                showSearch
                filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
              />
              {needsCouncil && (
                <Select
                  placeholder="اختر المجلس (مطلوب للأدوار المرتبطة بمجلس)"
                  style={{ width: '100%' }}
                  value={selectedCouncilId}
                  onChange={setSelectedCouncilId}
                  options={councilOptions}
                />
              )}
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAssignRole}
                disabled={!selectedRoleId || (needsCouncil && !selectedCouncilId)}
                loading={assignRoleMutation.isPending}
              >
                إسناد الدور
              </Button>
            </Space>
          </>
        )}
      </Drawer>
    </div>
  );
}

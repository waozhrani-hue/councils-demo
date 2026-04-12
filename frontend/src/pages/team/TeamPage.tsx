import { useState, useMemo } from 'react';
import {
  Table,
  Button,
  Typography,
  Drawer,
  Form,
  Input,
  Select,
  Space,
  Tag,
  Popconfirm,
  message,
  Alert,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Title } = Typography;

const ROLE_LABELS: Record<string, string> = {
  SYSTEM_ADMIN: 'مدير النظام',
  DEPT_STAFF: 'موظف إدارة',
  DEPT_MANAGER: 'مدير إدارة',
  GENERAL_SECRETARY: 'الأمين العام',
  GS_OFFICE_STAFF: 'موظف مكتب الأمين',
  EXAM_OFFICER: 'مسؤول الفحص',
  COUNCIL_SECRETARY: 'أمين المجلس',
  COUNCIL_PRESIDENT: 'رئيس المجلس',
  COUNCIL_MEMBER: 'عضو مجلس',
  COUNCIL_STAFF: 'موظف مجلس',
};

const ROLE_COLORS: Record<string, string> = {
  COUNCIL_MEMBER: 'blue',
  COUNCIL_STAFF: 'cyan',
  DEPT_STAFF: 'green',
  GS_OFFICE_STAFF: 'purple',
};

interface TeamMember {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
  createdAt: string;
  organization?: { id: string; name: string };
  roles: Array<{
    id: string;
    roleId: string;
    councilId?: string;
    role: { id: string; code: string; labelAr: string };
    council?: { id: string; name: string };
  }>;
}

interface AssignableData {
  roles: Array<{ id: string; code: string; labelAr: string }>;
  councils: Array<{ id: string; name: string }>;
  permissions: Array<{
    managerRole: string;
    allowedRoles: string[];
    scope: 'council' | 'org' | 'global';
    councilIds: string[];
  }>;
}

export default function TeamPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form] = Form.useForm();

  const { data: assignable } = useQuery({
    queryKey: ['team-assignable-roles'],
    queryFn: () => apiClient.get<AssignableData>('/api/v1/team/assignable-roles'),
  });

  const { data: members, isLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: () => apiClient.get<TeamMember[]>('/api/v1/team/members'),
  });

  const createMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      apiClient.post('/api/v1/team/members', values),
    onSuccess: () => {
      message.success('تم إنشاء العضو بنجاح');
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      closeDrawer();
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message || err.message || 'فشل الإنشاء');
    },
  });

  const removeRoleMutation = useMutation({
    mutationFn: (data: { userId: string; userRoleId: string }) =>
      apiClient.delete(`/api/v1/team/members/${data.userId}/roles/${data.userRoleId}`),
    onSuccess: () => {
      message.success('تم إزالة الدور');
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message || err.message || 'فشلت الإزالة');
    },
  });

  const roles = assignable?.roles ?? [];
  const councils = assignable?.councils ?? [];
  const permissions = assignable?.permissions ?? [];

  // هل النطاق يتطلب اختيار مجلس؟
  const needsCouncil = useMemo(() => {
    return permissions.some((p) => p.scope === 'council');
  }, [permissions]);

  // الدور المختار يحتاج مجلس؟
  const selectedRoleCode = Form.useWatch('roleCode', form);
  const selectedRoleNeedsCouncil = useMemo(() => {
    if (!selectedRoleCode) return false;
    return ['COUNCIL_MEMBER', 'COUNCIL_STAFF', 'EXAM_OFFICER', 'COUNCIL_SECRETARY', 'COUNCIL_PRESIDENT'].includes(selectedRoleCode);
  }, [selectedRoleCode]);

  // عنوان الصفحة حسب الدور
  const pageTitle = useMemo(() => {
    const codes = user?.roles.map((r) => r.code) ?? [];
    if (codes.includes('COUNCIL_SECRETARY')) return 'إدارة أعضاء المجلس';
    if (codes.includes('DEPT_MANAGER')) return 'إدارة موظفي الإدارة';
    if (codes.includes('GENERAL_SECRETARY')) return 'إدارة موظفي المكتب';
    return 'إدارة الفريق';
  }, [user]);

  const openDrawer = () => {
    form.resetFields();
    // إذا كان هناك مجلس واحد فقط، اختره تلقائياً
    if (councils.length === 1) {
      form.setFieldValue('councilId', councils[0].id);
    }
    // إذا كان هناك دور واحد فقط، اختره تلقائياً
    if (roles.length === 1) {
      form.setFieldValue('roleCode', roles[0].code);
    }
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    form.resetFields();
  };

  const handleSave = () => {
    form.validateFields().then((values) => {
      createMutation.mutate(values);
    });
  };

  const columns: ColumnsType<TeamMember> = [
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
      width: 300,
      render: (_: unknown, record: TeamMember) => (
        <Space size={[0, 4]} wrap>
          {record.roles.map((ur) => (
            <Tag
              key={ur.id}
              color={ROLE_COLORS[ur.role.code] ?? 'default'}
              closable
              onClose={(e) => {
                e.preventDefault();
                removeRoleMutation.mutate({
                  userId: record.id,
                  userRoleId: ur.id,
                });
              }}
            >
              {ROLE_LABELS[ur.role.code] || ur.role.labelAr}
              {ur.council ? ` — ${ur.council.name}` : ''}
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
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          {pageTitle}
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openDrawer}>
          إضافة عضو
        </Button>
      </div>

      {permissions.length > 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={
            <span>
              يمكنك إضافة:{' '}
              {roles.map((r) => (
                <Tag key={r.code} color={ROLE_COLORS[r.code] ?? 'blue'}>
                  {ROLE_LABELS[r.code] || r.labelAr}
                </Tag>
              ))}
              {councils.length > 0 && (
                <>
                  في:{' '}
                  {councils.map((c) => (
                    <Tag key={c.id}>{c.name}</Tag>
                  ))}
                </>
              )}
            </span>
          }
        />
      )}

      <Table
        columns={columns}
        dataSource={Array.isArray(members) ? members : []}
        rowKey="id"
        loading={isLoading}
        pagination={{ pageSize: 15, showTotal: (t) => `الإجمالي: ${t}` }}
        scroll={{ x: 900 }}
      />

      <Drawer
        title="إضافة عضو جديد"
        open={drawerOpen}
        onClose={closeDrawer}
        width={480}
        extra={
          <Space>
            <Button onClick={closeDrawer}>إلغاء</Button>
            <Button type="primary" onClick={handleSave} loading={createMutation.isPending}>
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
          <Form.Item
            name="password"
            label="كلمة المرور"
            rules={[
              { required: true, message: 'مطلوب' },
              { min: 6, message: 'الحد الأدنى 6 أحرف' },
            ]}
          >
            <Input.Password placeholder="أدخل كلمة المرور" />
          </Form.Item>
          <Form.Item
            name="roleCode"
            label="الدور"
            rules={[{ required: true, message: 'مطلوب' }]}
          >
            <Select
              placeholder="اختر الدور"
              options={roles.map((r) => ({
                label: ROLE_LABELS[r.code] || r.labelAr,
                value: r.code,
              }))}
            />
          </Form.Item>
          {selectedRoleNeedsCouncil && councils.length > 0 && (
            <Form.Item
              name="councilId"
              label="المجلس"
              rules={[{ required: true, message: 'مطلوب' }]}
            >
              <Select
                placeholder="اختر المجلس"
                options={councils.map((c) => ({
                  label: c.name,
                  value: c.id,
                }))}
              />
            </Form.Item>
          )}
        </Form>
      </Drawer>
    </div>
  );
}

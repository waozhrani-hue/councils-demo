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
  Divider,
  Tree,
  Card,
  Tabs,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  ApartmentOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface TeamMember {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
  createdAt: string;
  organization?: { id: string; name: string };
  maxClearance?: { id: string; name: string };
  roles: Array<{
    id: string;
    roleId: string;
    councilId?: string;
    role: { id: string; code: string; nameAr?: string; labelAr?: string };
    council?: { id: string; name: string };
  }>;
}

interface AssignableData {
  roles: Array<{ id: string; code: string; nameAr?: string; labelAr?: string; scope?: string }>;
  councils: Array<{ id: string; name: string }>;
  orgUnits: Array<{ id: string; name: string; parentId?: string; level: number }>;
}

export default function TeamPage() {
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [unitDrawerOpen, setUnitDrawerOpen] = useState(false);
  const [form] = Form.useForm();
  const [unitForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState('members');

  const { data: assignable } = useQuery({
    queryKey: ['team-assignable-roles'],
    queryFn: () => apiClient.get<AssignableData>('/api/v1/team/assignable-roles'),
  });

  const { data: members, isLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: () => apiClient.get<TeamMember[]>('/api/v1/team/members'),
  });

  const { data: orgTree } = useQuery({
    queryKey: ['team-org-tree'],
    queryFn: () => apiClient.get<any[]>('/api/v1/team/org-tree'),
  });

  const { data: clearanceLevels } = useQuery({
    queryKey: ['clearance-levels'],
    queryFn: () => apiClient.get<any[]>('/api/v1/configs/secret-levels'),
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

  const createUnitMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      apiClient.post('/api/v1/team/sub-units', values),
    onSuccess: () => {
      message.success('تم إنشاء الوحدة الفرعية');
      queryClient.invalidateQueries({ queryKey: ['team-org-tree'] });
      setUnitDrawerOpen(false);
      unitForm.resetFields();
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

  const getRoleName = (role: any) => role?.nameAr || role?.labelAr || role?.code || '';

  // Determine if the selected role needs a council
  const selectedRoleId = Form.useWatch('roleId', form);
  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedRoleId),
    [roles, selectedRoleId],
  );
  const needsCouncil = selectedRole?.scope === 'COUNCIL';

  // Build org tree data for Tree component
  const treeData = useMemo(() => {
    if (!orgTree || !Array.isArray(orgTree)) return [];
    const map = new Map<string, any>();
    const roots: any[] = [];
    for (const unit of orgTree) {
      map.set(unit.id, { title: unit.name, key: unit.id, children: [] });
    }
    for (const unit of orgTree) {
      const node = map.get(unit.id);
      if (unit.parentId && map.has(unit.parentId)) {
        map.get(unit.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }, [orgTree]);

  const clearanceOptions = (Array.isArray(clearanceLevels) ? clearanceLevels : []).map((c: any) => ({
    label: c.name,
    value: c.id,
  }));

  const openDrawer = () => {
    form.resetFields();
    if (councils.length === 1) {
      form.setFieldValue('councilId', councils[0].id);
    }
    if (roles.length === 1) {
      form.setFieldValue('roleId', roles[0].id);
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

  const handleCreateUnit = () => {
    unitForm.validateFields().then((values) => {
      createUnitMutation.mutate(values);
    });
  };

  const columns: ColumnsType<TeamMember> = [
    { title: 'الاسم', dataIndex: 'displayName', key: 'displayName', width: 180 },
    { title: 'البريد الإلكتروني', dataIndex: 'email', key: 'email', width: 220 },
    {
      title: 'الوحدة التنظيمية',
      key: 'organization',
      width: 140,
      render: (_: unknown, record: TeamMember) => record.organization?.name || '-',
    },
    {
      title: 'الأدوار',
      key: 'roles',
      width: 280,
      render: (_: unknown, record: TeamMember) => (
        <Space size={[0, 4]} wrap>
          {record.roles.map((ur) => (
            <Tag
              key={ur.id}
              color="blue"
              closable
              onClose={(e) => {
                e.preventDefault();
                removeRoleMutation.mutate({ userId: record.id, userRoleId: ur.id });
              }}
            >
              {getRoleName(ur.role)}
              {ur.council ? ` — ${ur.council.name}` : ''}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'مستوى التصنيف',
      key: 'clearance',
      width: 120,
      render: (_: unknown, record: TeamMember) =>
        record.maxClearance ? <Tag>{record.maxClearance.name}</Tag> : '-',
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
        <Title level={4} style={{ margin: 0 }}>إدارة الفريق</Title>
        <Space>
          <Button icon={<ApartmentOutlined />} onClick={() => setUnitDrawerOpen(true)}>
            إضافة وحدة فرعية
          </Button>
          <Button type="primary" icon={<UserAddOutlined />} onClick={openDrawer}>
            إضافة عضو
          </Button>
        </Space>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'members',
            label: 'الأعضاء',
            children: (
              <Table
                columns={columns}
                dataSource={Array.isArray(members) ? members : []}
                rowKey="id"
                loading={isLoading}
                pagination={{ pageSize: 15, showTotal: (t) => `الإجمالي: ${t}` }}
                scroll={{ x: 1100 }}
              />
            ),
          },
          {
            key: 'structure',
            label: 'الهيكل التنظيمي',
            children: (
              <Card>
                {treeData.length > 0 ? (
                  <Tree
                    treeData={treeData}
                    defaultExpandAll
                    showLine
                    selectable={false}
                  />
                ) : (
                  <Text type="secondary">لا توجد وحدات تنظيمية</Text>
                )}
              </Card>
            ),
          },
        ]}
      />

      {/* Add Member Drawer */}
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
          <Form.Item name="displayName" label="الاسم" rules={[{ required: true, message: 'مطلوب' }]}>
            <Input placeholder="أدخل الاسم" />
          </Form.Item>
          <Form.Item name="email" label="البريد الإلكتروني"
            rules={[{ required: true, message: 'مطلوب' }, { type: 'email', message: 'بريد إلكتروني غير صالح' }]}>
            <Input placeholder="أدخل البريد الإلكتروني" />
          </Form.Item>
          <Form.Item name="password" label="كلمة المرور"
            rules={[{ required: true, message: 'مطلوب' }, { min: 6, message: 'الحد الأدنى 6 أحرف' }]}>
            <Input.Password placeholder="أدخل كلمة المرور" />
          </Form.Item>
          <Form.Item name="roleId" label="الدور" rules={[{ required: true, message: 'مطلوب' }]}>
            <Select
              placeholder="اختر الدور"
              showSearch
              filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
              options={roles.map((r) => ({
                label: getRoleName(r),
                value: r.id,
              }))}
            />
          </Form.Item>
          {needsCouncil && councils.length > 0 && (
            <Form.Item name="councilId" label="المجلس" rules={[{ required: true, message: 'مطلوب' }]}>
              <Select
                placeholder="اختر المجلس"
                options={councils.map((c) => ({ label: c.name, value: c.id }))}
              />
            </Form.Item>
          )}
          {(assignable?.orgUnits?.length ?? 0) > 0 && (
            <Form.Item name="organizationId" label="الوحدة التنظيمية">
              <Select
                placeholder="اختر الوحدة (اختياري)"
                allowClear
                showSearch
                filterOption={(input, option) => (option?.label as string)?.includes(input)}
                options={(assignable?.orgUnits ?? []).map((o) => ({
                  label: o.name,
                  value: o.id,
                }))}
              />
            </Form.Item>
          )}
          <Form.Item name="maxClearanceId" label="مستوى التصنيف الأمني">
            <Select
              placeholder="اختر المستوى (اختياري)"
              allowClear
              options={clearanceOptions}
            />
          </Form.Item>
        </Form>
      </Drawer>

      {/* Sub-Unit Drawer */}
      <Drawer
        title="إضافة وحدة فرعية"
        open={unitDrawerOpen}
        onClose={() => { setUnitDrawerOpen(false); unitForm.resetFields(); }}
        width={420}
        extra={
          <Space>
            <Button onClick={() => { setUnitDrawerOpen(false); unitForm.resetFields(); }}>إلغاء</Button>
            <Button type="primary" onClick={handleCreateUnit} loading={createUnitMutation.isPending}>
              إنشاء
            </Button>
          </Space>
        }
      >
        <Form form={unitForm} layout="vertical">
          <Form.Item name="name" label="اسم الوحدة" rules={[{ required: true, message: 'مطلوب' }]}>
            <Input placeholder="أدخل اسم الوحدة" />
          </Form.Item>
          <Form.Item name="code" label="الرمز">
            <Input placeholder="رمز فريد (اختياري)" />
          </Form.Item>
          <Form.Item name="unitType" label="نوع الوحدة">
            <Select
              placeholder="اختر النوع"
              allowClear
              options={[
                { label: 'إدارة', value: 'DEPARTMENT' },
                { label: 'قسم', value: 'DIVISION' },
                { label: 'شعبة', value: 'SECTION' },
                { label: 'وحدة', value: 'UNIT' },
              ]}
            />
          </Form.Item>
          {(assignable?.orgUnits?.length ?? 0) > 1 && (
            <Form.Item name="parentId" label="تحت وحدة (اختياري — الافتراضي: وحدتك)">
              <Select
                placeholder="اختر الوحدة الأم"
                allowClear
                showSearch
                filterOption={(input, option) => (option?.label as string)?.includes(input)}
                options={(assignable?.orgUnits ?? []).map((o) => ({
                  label: `${'—'.repeat(o.level)} ${o.name}`,
                  value: o.id,
                }))}
              />
            </Form.Item>
          )}
        </Form>
      </Drawer>
    </div>
  );
}

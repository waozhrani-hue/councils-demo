import { useState } from 'react';
import { Table, Card, Tag, Typography, Collapse, List, Button, Modal, Form, Input, Select, Space, Switch, message } from 'antd';
import { SafetyOutlined, PlusOutlined, EditOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

const { Title, Text } = Typography;

interface Permission {
  id: string;
  code: string;
  nameAr: string;
  module: string;
  isActive: boolean;
}

interface RolePermission {
  permission: Permission;
}

interface Role {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  description: string | null;
  scope: string;
  isSystem: boolean;
  permissions: RolePermission[];
}

export default function AdminRolesPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [form] = Form.useForm();

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => apiClient.get<Role[]>('/api/v1/workflow/roles'),
  });

  const { data: permissions = [] } = useQuery({
    queryKey: ['all-permissions'],
    queryFn: () => apiClient.get<Permission[]>('/api/v1/workflow/permissions'),
  });

  const { data: workflowDefs } = useQuery({
    queryKey: ['workflow-definitions'],
    queryFn: () => apiClient.get<any[]>('/api/v1/workflow/definitions'),
  });

  const saveMutation = useMutation({
    mutationFn: (values: any) => {
      if (editingRole) {
        return apiClient.patch(`/api/v1/workflow/roles/${editingRole.id}`, values);
      }
      return apiClient.post('/api/v1/workflow/roles', values);
    },
    onSuccess: () => {
      message.success(editingRole ? 'تم تحديث الدور' : 'تم إنشاء الدور');
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      setModalOpen(false);
      setEditingRole(null);
      form.resetFields();
    },
    onError: (err: Error) => message.error(err.message),
  });

  const openCreate = () => {
    setEditingRole(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (role: Role) => {
    setEditingRole(role);
    form.setFieldsValue({
      code: role.code,
      nameAr: role.nameAr,
      nameEn: role.nameEn,
      description: role.description,
      scope: role.scope,
      permissionIds: role.permissions.map((rp) => rp.permission.id),
    });
    setModalOpen(true);
  };

  // Group permissions by module
  const permissionsByModule: Record<string, Permission[]> = {};
  (Array.isArray(permissions) ? permissions : []).forEach((p) => {
    if (!permissionsByModule[p.module]) permissionsByModule[p.module] = [];
    permissionsByModule[p.module].push(p);
  });

  const permOptions = (Array.isArray(permissions) ? permissions : []).map((p) => ({
    label: `${p.nameAr} (${p.code})`,
    value: p.id,
  }));

  const columns = [
    { title: 'الكود', dataIndex: 'code', key: 'code', width: 180 },
    { title: 'الاسم (عربي)', dataIndex: 'nameAr', key: 'nameAr' },
    { title: 'الاسم (إنجليزي)', dataIndex: 'nameEn', key: 'nameEn' },
    { title: 'النطاق', dataIndex: 'scope', key: 'scope', width: 100, render: (s: string) => <Tag>{s}</Tag> },
    {
      title: 'نظامي',
      dataIndex: 'isSystem',
      key: 'isSystem',
      width: 80,
      render: (v: boolean) => v ? <Tag color="red">نظامي</Tag> : <Tag color="green">مخصص</Tag>,
    },
    {
      title: 'الصلاحيات',
      key: 'permissions',
      width: 100,
      render: (_: any, record: Role) => <Tag>{record.permissions?.length || 0}</Tag>,
    },
    {
      title: 'إجراءات',
      key: 'actions',
      width: 80,
      render: (_: any, record: Role) => (
        <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(record)} />
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          <SafetyOutlined /> الأدوار والصلاحيات
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>إضافة دور</Button>
      </div>

      <Table columns={columns} dataSource={Array.isArray(roles) ? roles : []} rowKey="id" loading={isLoading}
        expandable={{
          expandedRowRender: (record: Role) => (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {record.permissions?.map((rp) => (
                <Tag key={rp.permission.id} color="blue">{rp.permission.nameAr} ({rp.permission.code})</Tag>
              ))}
              {(!record.permissions || record.permissions.length === 0) && <Text type="secondary">لا توجد صلاحيات</Text>}
            </div>
          ),
        }}
        style={{ marginBottom: 24 }}
      />

      {workflowDefs && (
        <Card title="تعريفات سير العمل">
          <Collapse>
            {(Array.isArray(workflowDefs) ? workflowDefs : []).map((def: any) => (
              <Collapse.Panel key={def.id} header={`${def.nameAr} (${def.entityType})`}>
                <Title level={5}>الحالات</Title>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 16 }}>
                  {def.states?.map((s: any) => (
                    <Tag key={s.id} color={s.color}>{s.nameAr} ({s.code})</Tag>
                  ))}
                </div>
                <Title level={5}>الانتقالات</Title>
                <List size="small" dataSource={def.transitions || []}
                  renderItem={(t: any) => (
                    <List.Item>
                      <Text>{t.actionNameAr}</Text>
                      <Text type="secondary" style={{ margin: '0 8px' }}>
                        {t.fromState?.nameAr} → {t.toState?.nameAr}
                      </Text>
                      <Tag>{t.permissionCode}</Tag>
                    </List.Item>
                  )}
                />
              </Collapse.Panel>
            ))}
          </Collapse>
        </Card>
      )}

      <Modal
        title={editingRole ? 'تعديل الدور' : 'إضافة دور جديد'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditingRole(null); }}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        okText="حفظ"
        cancelText="إلغاء"
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={(v) => saveMutation.mutate(v)}>
          <Form.Item name="code" label="الكود" rules={[{ required: true }]}>
            <Input disabled={!!editingRole?.isSystem} />
          </Form.Item>
          <Form.Item name="nameAr" label="الاسم (عربي)" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="nameEn" label="الاسم (إنجليزي)" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="الوصف">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="scope" label="النطاق" initialValue="GLOBAL">
            <Select options={[
              { label: 'عام', value: 'GLOBAL' },
              { label: 'مجلس', value: 'COUNCIL' },
            ]} />
          </Form.Item>
          <Form.Item name="permissionIds" label="الصلاحيات">
            <Select mode="multiple" options={permOptions} placeholder="اختر الصلاحيات"
              showSearch filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
              style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

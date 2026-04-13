import { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Switch, Space, Typography, message, Tree } from 'antd';
import { PlusOutlined, EditOutlined, ApartmentOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

const { Title } = Typography;

interface OrgUnit {
  id: string;
  name: string;
  code: string;
  level: number;
  unitType: string;
  isApprovalAuthority: boolean;
  isActive: boolean;
  parentId: string | null;
  managerId: string | null;
  parent?: { id: string; name: string } | null;
  children?: OrgUnit[];
  manager?: { id: string; displayName: string } | null;
}

interface UserOption {
  id: string;
  displayName: string;
  email: string;
}

export default function AdminOrgStructurePage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<OrgUnit | null>(null);
  const [form] = Form.useForm();

  const { data: orgUnits = [], isLoading } = useQuery({
    queryKey: ['org-units'],
    queryFn: () => apiClient.get<OrgUnit[]>('/api/v1/org-units'),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => apiClient.get<UserOption[]>('/api/v1/users'),
  });

  const saveMutation = useMutation({
    mutationFn: (values: any) => {
      if (editingUnit) {
        return apiClient.patch(`/api/v1/org-units/${editingUnit.id}`, values);
      }
      return apiClient.post('/api/v1/org-units', values);
    },
    onSuccess: () => {
      message.success(editingUnit ? 'تم التحديث بنجاح' : 'تم الإنشاء بنجاح');
      queryClient.invalidateQueries({ queryKey: ['org-units'] });
      setModalOpen(false);
      setEditingUnit(null);
      form.resetFields();
    },
    onError: (err: Error) => message.error(err.message),
  });

  const openCreate = () => {
    setEditingUnit(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (unit: OrgUnit) => {
    setEditingUnit(unit);
    form.setFieldsValue({
      name: unit.name,
      code: unit.code,
      parentId: unit.parentId,
      unitType: unit.unitType,
      isApprovalAuthority: unit.isApprovalAuthority,
      isActive: unit.isActive,
      managerId: unit.managerId,
    });
    setModalOpen(true);
  };

  // Build tree data for display
  const buildTree = (units: OrgUnit[]): any[] => {
    const map = new Map<string, any>();
    const roots: any[] = [];
    for (const u of units) {
      map.set(u.id, { ...u, key: u.id, title: `${u.name} (${u.code})`, children: [] });
    }
    for (const u of units) {
      const node = map.get(u.id)!;
      if (u.parentId && map.has(u.parentId)) {
        map.get(u.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  };

  const treeData = buildTree(orgUnits);

  const columns = [
    { title: 'الاسم', dataIndex: 'name', key: 'name' },
    { title: 'الكود', dataIndex: 'code', key: 'code', width: 150 },
    { title: 'المستوى', dataIndex: 'level', key: 'level', width: 80 },
    { title: 'النوع', dataIndex: 'unitType', key: 'unitType', width: 120 },
    { title: 'الجهة الأم', dataIndex: ['parent', 'name'], key: 'parent', width: 150 },
    {
      title: 'جهة اعتماد',
      dataIndex: 'isApprovalAuthority',
      key: 'isApprovalAuthority',
      width: 100,
      render: (v: boolean) => (v ? 'نعم' : 'لا'),
    },
    {
      title: 'إجراءات',
      key: 'actions',
      width: 80,
      render: (_: any, record: OrgUnit) => (
        <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(record)} />
      ),
    },
  ];

  const userOptions = (Array.isArray(users) ? users : (users as any)?.data || []).map((u: any) => ({
    label: `${u.displayName} (${u.email})`,
    value: u.id,
  }));

  const parentOptions = orgUnits.map((u) => ({ label: `${u.name} (${u.code})`, value: u.id }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          <ApartmentOutlined /> الهيكل التنظيمي
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          إضافة وحدة
        </Button>
      </div>

      <div style={{ marginBottom: 24, padding: 16, background: '#fafafa', borderRadius: 8 }}>
        <Title level={5}>الهيكل الشجري</Title>
        <Tree treeData={treeData} defaultExpandAll showLine />
      </div>

      <Table columns={columns} dataSource={orgUnits} rowKey="id" loading={isLoading} size="small" />

      <Modal
        title={editingUnit ? 'تعديل الوحدة' : 'إضافة وحدة جديدة'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditingUnit(null); }}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        okText="حفظ"
        cancelText="إلغاء"
      >
        <Form form={form} layout="vertical" onFinish={(v) => saveMutation.mutate(v)}>
          <Form.Item name="name" label="الاسم" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="code" label="الكود" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="parentId" label="الجهة الأم">
            <Select allowClear options={parentOptions} placeholder="اختر الجهة الأم" showSearch
              filterOption={(input, option) => (option?.label as string)?.includes(input)} />
          </Form.Item>
          <Form.Item name="unitType" label="نوع الوحدة" initialValue="DEPARTMENT">
            <Select options={[
              { label: 'جذر', value: 'ROOT' },
              { label: 'قطاع', value: 'SECTOR' },
              { label: 'إدارة عامة', value: 'GENERAL_DIRECTORATE' },
              { label: 'إدارة', value: 'DEPARTMENT' },
              { label: 'قسم', value: 'SECTION' },
              { label: 'وحدة', value: 'UNIT' },
            ]} />
          </Form.Item>
          <Form.Item name="managerId" label="المدير">
            <Select allowClear options={userOptions} placeholder="اختر المدير" showSearch
              filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())} />
          </Form.Item>
          <Form.Item name="isApprovalAuthority" label="جهة اعتماد" valuePropName="checked" initialValue={false}>
            <Switch />
          </Form.Item>
          <Form.Item name="isActive" label="نشط" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

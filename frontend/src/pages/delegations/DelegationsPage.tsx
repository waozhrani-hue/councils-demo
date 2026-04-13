import { useState } from 'react';
import {
  Table,
  Button,
  Typography,
  Modal,
  Form,
  Select,
  DatePicker,
  Input,
  Space,
  Tag,
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import StatusBadge from '@/components/StatusBadge';
import type { Delegation, User, Council, PaginatedResponse } from '@/types';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Title } = Typography;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

interface Role {
  id: string;
  code: string;
  nameAr: string;
  scope: string;
}

interface Permission {
  id: string;
  code: string;
  nameAr: string;
  module: string;
}

export default function DelegationsPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();

  const { data: users } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => apiClient.get<User[]>('/api/v1/users'),
  });

  const { data: allRoles } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => apiClient.get<Role[]>('/api/v1/workflow/roles'),
  });

  const { data: councils } = useQuery({
    queryKey: ['councils'],
    queryFn: () => apiClient.get<Council[]>('/api/v1/councils'),
  });

  const { data: allPermissions } = useQuery({
    queryKey: ['admin-permissions'],
    queryFn: () => apiClient.get<Permission[]>('/api/v1/workflow/permissions'),
  });

  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('pageSize', String(pageSize));

  const { data, isLoading } = useQuery({
    queryKey: ['delegations', page, pageSize],
    queryFn: () =>
      apiClient.get<PaginatedResponse<Delegation>>(`/api/v1/delegations?${queryParams.toString()}`),
  });

  const createMutation = useMutation({
    mutationFn: (values: {
      fromUserId: string;
      toUserId: string;
      scopeType: string;
      scopeJson: string;
      validFrom: string;
      validUntil: string;
      reason?: string;
    }) => apiClient.post<Delegation>('/api/v1/delegations', values),
    onSuccess: () => {
      message.success('تم إنشاء التفويض');
      queryClient.invalidateQueries({ queryKey: ['delegations'] });
      setCreateModalOpen(false);
      form.resetFields();
    },
    onError: (err: Error) => {
      message.error(err.message || 'فشل إنشاء التفويض');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/api/v1/delegations/${id}/revoke`),
    onSuccess: () => {
      message.success('تم إلغاء التفويض');
      queryClient.invalidateQueries({ queryKey: ['delegations'] });
    },
    onError: (err: Error) => {
      message.error(err.message || 'فشل إلغاء التفويض');
    },
  });

  const scopeType = Form.useWatch('scopeType', form);

  const handleCreate = () => {
    form.validateFields().then((values) => {
      const [validFrom, validUntil] = values.dateRange;

      let scopeJson = '{}';
      if (values.scopeType === 'FULL_ROLE') {
        scopeJson = JSON.stringify({
          roleCode: values.roleCode,
          councilId: values.councilId,
        });
      } else if (values.scopeType === 'SPECIFIC_PERMISSION') {
        scopeJson = JSON.stringify({
          permissionCodes: values.permissionCodes,
          councilId: values.councilId,
        });
      } else if (values.scopeType === 'TOPIC_TYPE') {
        scopeJson = JSON.stringify({ topicType: values.topicType });
      }

      createMutation.mutate({
        fromUserId: user?.id || '',
        toUserId: values.toUserId,
        scopeType: values.scopeType,
        scopeJson,
        validFrom: validFrom.toISOString(),
        validUntil: validUntil.toISOString(),
        reason: values.reason,
      });
    });
  };

  const getScopeLabel = (record: any) => {
    try {
      const scope = JSON.parse(record.scopeJson || '{}');
      if (record.scopeType === 'FULL_ROLE') {
        const role = (Array.isArray(allRoles) ? allRoles : []).find((r) => r.code === scope.roleCode);
        return role ? `دور: ${role.nameAr}` : `دور: ${scope.roleCode}`;
      }
      if (record.scopeType === 'SPECIFIC_PERMISSION') {
        const codes = scope.permissionCodes || [];
        return `${codes.length} صلاحية محددة`;
      }
      if (record.scopeType === 'TOPIC_TYPE') {
        return `نوع موضوع: ${scope.topicType}`;
      }
    } catch { /* ignore */ }
    return record.scopeType;
  };

  const columns: ColumnsType<Delegation> = [
    {
      title: 'المفوض إليه',
      dataIndex: ['toUser', 'displayName'],
      key: 'toUser',
      width: 160,
    },
    {
      title: 'نوع التفويض',
      key: 'scopeType',
      width: 140,
      render: (_: unknown, record: any) => {
        const labels: Record<string, { text: string; color: string }> = {
          FULL_ROLE: { text: 'دور كامل', color: 'purple' },
          SPECIFIC_PERMISSION: { text: 'صلاحيات محددة', color: 'blue' },
          TOPIC_TYPE: { text: 'نوع موضوع', color: 'green' },
        };
        const info = labels[record.scopeType] || { text: record.scopeType, color: 'default' };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: 'النطاق',
      key: 'scope',
      width: 180,
      render: (_: unknown, record: any) => getScopeLabel(record),
    },
    {
      title: 'من تاريخ',
      dataIndex: 'validFrom',
      key: 'validFrom',
      width: 120,
      render: (date: string) => date ? dayjs(date).format('YYYY/MM/DD') : '-',
    },
    {
      title: 'إلى تاريخ',
      dataIndex: 'validUntil',
      key: 'validUntil',
      width: 120,
      render: (date: string) => date ? dayjs(date).format('YYYY/MM/DD') : '-',
    },
    {
      title: 'الحالة',
      dataIndex: 'state',
      key: 'state',
      width: 100,
      render: (s: string) => <StatusBadge status={s} />,
    },
    {
      title: 'الإجراء',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: any) =>
        record.state === 'DELEGATION_ACTIVE' ? (
          <Button
            size="small"
            danger
            onClick={() => revokeMutation.mutate(record.id)}
            loading={revokeMutation.isPending}
          >
            إلغاء
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>التفويضات</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
          إنشاء تفويض
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
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
      />

      <Modal
        title="إنشاء تفويض جديد"
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => { setCreateModalOpen(false); form.resetFields(); }}
        confirmLoading={createMutation.isPending}
        okText="إنشاء"
        cancelText="إلغاء"
        width={560}
      >
        <Form form={form} layout="vertical" initialValues={{ scopeType: 'FULL_ROLE' }}>
          <Form.Item name="toUserId" label="المفوض إليه" rules={[{ required: true, message: 'مطلوب' }]}>
            <Select
              placeholder="اختر المستخدم"
              showSearch
              optionFilterProp="label"
              options={(Array.isArray(users) ? users : [])
                .filter((u) => u.id !== user?.id)
                .map((u) => ({ label: u.displayName, value: u.id }))}
            />
          </Form.Item>

          <Form.Item name="scopeType" label="نوع التفويض" rules={[{ required: true, message: 'مطلوب' }]}>
            <Select
              options={[
                { label: 'تفويض دور كامل', value: 'FULL_ROLE' },
                { label: 'صلاحيات محددة', value: 'SPECIFIC_PERMISSION' },
                { label: 'نوع موضوع', value: 'TOPIC_TYPE' },
              ]}
            />
          </Form.Item>

          {scopeType === 'FULL_ROLE' && (
            <Form.Item name="roleCode" label="الدور المفوض" rules={[{ required: true, message: 'مطلوب' }]}>
              <Select
                placeholder="اختر الدور"
                showSearch
                filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
                options={(Array.isArray(allRoles) ? allRoles : []).map((r) => ({
                  label: `${r.nameAr} (${r.code})`,
                  value: r.code,
                }))}
              />
            </Form.Item>
          )}

          {scopeType === 'SPECIFIC_PERMISSION' && (
            <Form.Item name="permissionCodes" label="الصلاحيات المفوضة" rules={[{ required: true, message: 'مطلوب' }]}>
              <Select
                mode="multiple"
                placeholder="اختر الصلاحيات"
                showSearch
                filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
                options={(Array.isArray(allPermissions) ? allPermissions : []).map((p) => ({
                  label: `${p.nameAr} (${p.code})`,
                  value: p.code,
                }))}
              />
            </Form.Item>
          )}

          {scopeType === 'TOPIC_TYPE' && (
            <Form.Item name="topicType" label="نوع الموضوع" rules={[{ required: true, message: 'مطلوب' }]}>
              <Input placeholder="أدخل نوع الموضوع" />
            </Form.Item>
          )}

          <Form.Item name="councilId" label="نطاق المجلس (اختياري)">
            <Select
              placeholder="الكل"
              allowClear
              showSearch
              optionFilterProp="label"
              options={(Array.isArray(councils) ? councils : []).map((c) => ({
                label: c.name,
                value: c.id,
              }))}
            />
          </Form.Item>

          <Form.Item name="dateRange" label="الفترة" rules={[{ required: true, message: 'مطلوب' }]}>
            <RangePicker style={{ width: '100%' }} placeholder={['من تاريخ', 'إلى تاريخ']} />
          </Form.Item>

          <Form.Item name="reason" label="السبب">
            <TextArea rows={3} placeholder="أدخل سبب التفويض" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

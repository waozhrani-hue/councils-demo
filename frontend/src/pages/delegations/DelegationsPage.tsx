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

  const { data: councils } = useQuery({
    queryKey: ['councils'],
    queryFn: () => apiClient.get<Council[]>('/api/v1/councils'),
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

  const handleCreate = () => {
    form.validateFields().then((values) => {
      const [validFrom, validUntil] = values.dateRange;
      // بناء scopeJson من المجلس المختار (أو تفويض عام)
      const scopeJson = values.councilId
        ? JSON.stringify({ councilId: values.councilId })
        : JSON.stringify({ all: true });
      createMutation.mutate({
        fromUserId: user?.id || '',
        toUserId: values.toUserId,
        scopeType: values.councilId ? 'COUNCIL' : 'ALL',
        scopeJson,
        validFrom: validFrom.toISOString(),
        validUntil: validUntil.toISOString(),
        reason: values.reason,
      });
    });
  };

  const columns: ColumnsType<Delegation> = [
    {
      title: 'المفوض إليه',
      dataIndex: ['toUser', 'displayName'],
      key: 'toUser',
      width: 160,
    },
    {
      title: 'المجلس',
      dataIndex: ['council', 'name'],
      key: 'council',
      width: 140,
      render: (text: string) => text || 'الكل',
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
      title: 'السبب',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
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
        <Title level={4} style={{ margin: 0 }}>
          التفويضات
        </Title>
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
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      <Modal
        title="إنشاء تفويض جديد"
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => {
          setCreateModalOpen(false);
          form.resetFields();
        }}
        confirmLoading={createMutation.isPending}
        okText="إنشاء"
        cancelText="إلغاء"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="toUserId" label="المفوض إليه" rules={[{ required: true, message: 'مطلوب' }]}>
            <Select
              placeholder="اختر المستخدم"
              showSearch
              optionFilterProp="label"
              options={(Array.isArray(users) ? users : []).map((u) => ({
                label: u.displayName,
                value: u.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="councilId" label="المجلس (اختياري)">
            <Select
              placeholder="الكل"
              allowClear
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

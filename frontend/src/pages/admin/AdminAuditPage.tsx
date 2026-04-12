import { useState } from 'react';
import { Table, Typography, Select, Input, DatePicker, Space } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { AuditLog, User, PaginatedResponse } from '@/types';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Title } = Typography;
const { RangePicker } = DatePicker;

export default function AdminAuditPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [action, setAction] = useState<string | undefined>();
  const [entity, setEntity] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  const { data: users } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => apiClient.get<User[]>('/api/v1/users'),
  });

  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('pageSize', String(pageSize));
  if (action) queryParams.set('action', action);
  if (entity) queryParams.set('entity', entity);
  if (search) queryParams.set('search', search);
  if (dateRange?.[0]) queryParams.set('startDate', dateRange[0].toISOString());
  if (dateRange?.[1]) queryParams.set('endDate', dateRange[1].toISOString());

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, pageSize, action, entity, search, dateRange?.[0]?.toISOString(), dateRange?.[1]?.toISOString()],
    queryFn: () =>
      apiClient.get<PaginatedResponse<AuditLog>>(`/api/v1/audit-logs?${queryParams.toString()}`),
  });

  const columns: ColumnsType<AuditLog> = [
    {
      title: 'التاريخ والوقت',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (date: string) => dayjs(date).format('YYYY/MM/DD HH:mm:ss'),
    },
    {
      title: 'المستخدم',
      dataIndex: ['user', 'displayName'],
      key: 'user',
      width: 150,
      render: (text: string) => text || 'النظام',
    },
    {
      title: 'الإجراء',
      dataIndex: 'action',
      key: 'action',
      width: 120,
    },
    {
      title: 'الكيان',
      dataIndex: 'entity',
      key: 'entity',
      width: 120,
    },
    {
      title: 'معرف الكيان',
      dataIndex: 'entityId',
      key: 'entityId',
      width: 140,
      ellipsis: true,
    },
    {
      title: 'عنوان IP',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      width: 130,
    },
    {
      title: 'القيمة القديمة',
      dataIndex: 'oldValue',
      key: 'oldValue',
      ellipsis: true,
      width: 200,
      render: (val: string) => {
        if (!val) return '-';
        try {
          return JSON.stringify(JSON.parse(val), null, 2).substring(0, 100);
        } catch {
          return val.substring(0, 100);
        }
      },
    },
    {
      title: 'القيمة الجديدة',
      dataIndex: 'newValue',
      key: 'newValue',
      ellipsis: true,
      width: 200,
      render: (val: string) => {
        if (!val) return '-';
        try {
          return JSON.stringify(JSON.parse(val), null, 2).substring(0, 100);
        } catch {
          return val.substring(0, 100);
        }
      },
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        سجل التدقيق
      </Title>

      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          placeholder="بحث..."
          prefix={<SearchOutlined />}
          style={{ width: 200 }}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          allowClear
        />
        <Select
          placeholder="الإجراء"
          allowClear
          style={{ width: 150 }}
          value={action}
          onChange={(val) => {
            setAction(val);
            setPage(1);
          }}
          options={[
            { label: 'إنشاء', value: 'CREATE' },
            { label: 'تحديث', value: 'UPDATE' },
            { label: 'حذف', value: 'DELETE' },
            { label: 'تسجيل دخول', value: 'LOGIN' },
            { label: 'تسجيل خروج', value: 'LOGOUT' },
            { label: 'انتقال حالة', value: 'TRANSITION' },
          ]}
        />
        <Select
          placeholder="الكيان"
          allowClear
          style={{ width: 150 }}
          value={entity}
          onChange={(val) => {
            setEntity(val);
            setPage(1);
          }}
          options={[
            { label: 'مستخدم', value: 'User' },
            { label: 'موضوع', value: 'Topic' },
            { label: 'اجتماع', value: 'Meeting' },
            { label: 'قرار', value: 'Decision' },
            { label: 'محضر', value: 'Minutes' },
            { label: 'مجلس', value: 'Council' },
            { label: 'تفويض', value: 'Delegation' },
          ]}
        />
        <RangePicker
          onChange={(dates) => {
            setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null);
            setPage(1);
          }}
          placeholder={['من تاريخ', 'إلى تاريخ']}
        />
      </Space>

      <Table
        columns={columns}
        dataSource={data?.data || []}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 1400 }}
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
    </div>
  );
}

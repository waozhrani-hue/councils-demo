import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Select, Input, Space, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';
import type { Topic, PaginatedResponse } from '@/types';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Title } = Typography;

const gsStatuses: string[] = ['INBOX_GS', 'GS_REVIEW', 'HIERARCHY_APPROVED', 'SENT_TO_GS'];

export default function GSInboxPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [status, setStatus] = useState<string | undefined>();
  const [search, setSearch] = useState('');

  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('limit', String(pageSize));
  queryParams.set('statuses', (status ? [status] : gsStatuses).join(','));
  if (search) queryParams.set('search', search);

  const { data, isLoading } = useQuery({
    queryKey: ['gs-inbox', page, pageSize, status, search],
    queryFn: () =>
      apiClient.get<PaginatedResponse<Topic>>(`/api/v1/topics?${queryParams.toString()}`),
  });

  const statusFilterOptions = gsStatuses.map((s) => ({
    label: {
      INBOX_GS: 'وارد الأمانة',
      GS_REVIEW: 'قيد المراجعة',
      HIERARCHY_APPROVED: 'معتمد هرمياً',
      SENT_TO_GS: 'مرسل للأمين',
    }[s] || s,
    value: s,
  }));

  const columns: ColumnsType<Topic> = [
    { title: 'الرقم المرجعي', dataIndex: 'referenceNumber', key: 'referenceNumber', width: 140 },
    {
      title: 'العنوان', dataIndex: 'title', key: 'title', ellipsis: true,
      render: (text: string, record: Topic) => (
        <a onClick={() => navigate(`/topics/${record.id}`)}>{text}</a>
      ),
    },
    { title: 'الإدارة', dataIndex: ['requestingOrg', 'name'], key: 'orgUnit', width: 140 },
    { title: 'الحالة', dataIndex: 'status', key: 'status', width: 160, render: (s: string) => <StatusBadge status={s} /> },
    { title: 'التاريخ', dataIndex: 'createdAt', key: 'createdAt', width: 110, render: (date: string) => dayjs(date).format('YYYY/MM/DD') },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>الوارد العام</Title>

      <Space wrap style={{ marginBottom: 16 }}>
        <Input placeholder="بحث..." prefix={<SearchOutlined />} style={{ width: 200 }} value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }} allowClear />
        <Select placeholder="الحالة" allowClear style={{ width: 180 }} value={status}
          onChange={(val) => { setStatus(val); setPage(1); }} options={statusFilterOptions} />
      </Space>

      <Table
        columns={columns}
        dataSource={data?.data || []}
        rowKey="id"
        loading={isLoading}
        pagination={{
          current: page, pageSize,
          total: data?.meta?.total || data?.total || 0,
          showSizeChanger: true,
          showTotal: (total) => `الإجمالي: ${total}`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
      />
    </div>
  );
}

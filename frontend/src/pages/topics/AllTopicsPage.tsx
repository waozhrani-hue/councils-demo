import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Select, Input, Space, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';
import { useWorkflowStates } from '@/hooks/usePermissions';
import type { Topic, Council, PaginatedResponse } from '@/types';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Title } = Typography;

export default function AllTopicsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<string | undefined>();
  const [councilId, setCouncilId] = useState<string | undefined>();
  const [search, setSearch] = useState('');

  const topicStates = useWorkflowStates('topic');
  const statusOptions = topicStates.map((s) => ({ label: s.nameAr, value: s.code }));

  const { data: councils } = useQuery({
    queryKey: ['councils'],
    queryFn: () => apiClient.get<Council[]>('/api/v1/councils'),
  });

  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('limit', String(pageSize));
  if (status) queryParams.set('status', status);
  if (councilId) queryParams.set('councilId', councilId);
  if (search) queryParams.set('search', search);

  const { data, isLoading } = useQuery({
    queryKey: ['all-topics', page, pageSize, status, councilId, search],
    queryFn: () =>
      apiClient.get<PaginatedResponse<Topic>>(`/api/v1/topics?${queryParams.toString()}`),
  });

  const columns: ColumnsType<Topic> = [
    { title: 'الرقم المرجعي', dataIndex: 'referenceNumber', key: 'referenceNumber', width: 150 },
    {
      title: 'العنوان', dataIndex: 'title', key: 'title', ellipsis: true,
      render: (text: string, record: Topic) => (
        <a onClick={() => navigate(`/topics/${record.id}`)}>{text}</a>
      ),
    },
    { title: 'المجلس', dataIndex: ['council', 'name'], key: 'council', width: 150 },
    { title: 'الحالة', dataIndex: 'status', key: 'status', width: 180, render: (s: string) => <StatusBadge status={s} /> },
    { title: 'الإدارة', dataIndex: ['requestingOrg', 'name'], key: 'requestingOrg', width: 150 },
    { title: 'مقدم الموضوع', dataIndex: ['createdBy', 'displayName'], key: 'createdBy', width: 150 },
    { title: 'التاريخ', dataIndex: 'createdAt', key: 'createdAt', width: 120, render: (date: string) => dayjs(date).format('YYYY/MM/DD') },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>جميع المواضيع</Title>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input placeholder="بحث..." prefix={<SearchOutlined />} style={{ width: 200 }} value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }} allowClear />
        <Select placeholder="الحالة" allowClear style={{ width: 180 }} value={status}
          onChange={(val) => { setStatus(val); setPage(1); }} options={statusOptions} />
        <Select placeholder="المجلس" allowClear style={{ width: 180 }} value={councilId}
          onChange={(val) => { setCouncilId(val); setPage(1); }}
          options={(Array.isArray(councils) ? councils : []).map((c) => ({ label: c.name, value: c.id }))} />
      </Space>
      <Table columns={columns} dataSource={data?.data || []} rowKey="id" loading={isLoading}
        pagination={{
          current: page, pageSize, total: data?.meta?.total || 0, showSizeChanger: true,
          showTotal: (total) => `الإجمالي: ${total}`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
      />
    </div>
  );
}

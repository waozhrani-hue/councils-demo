import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Typography, Select, Input, Space } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuthStore, getUserCouncilIds, isGlobalRole } from '@/lib/auth';
import StatusBadge from '@/components/StatusBadge';
import type { Decision, DecisionStatus, Council, PaginatedResponse } from '@/types';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Title } = Typography;

const statusOptions: { label: string; value: DecisionStatus }[] = [
  { label: 'نشط', value: 'ACTIVE' },
  { label: 'مستبدل', value: 'SUPERSEDED' },
  { label: 'ملغي', value: 'REVOKED' },
];

export default function DecisionsListPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const userCouncilIds = getUserCouncilIds(user);
  const global = isGlobalRole(user);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [status, setStatus] = useState<DecisionStatus | undefined>();
  const [councilId, setCouncilId] = useState<string | undefined>();
  const [search, setSearch] = useState('');

  const { data: councils } = useQuery({
    queryKey: ['councils'],
    queryFn: () => apiClient.get<Council[]>('/api/v1/councils'),
  });

  const availableCouncils = global
    ? (Array.isArray(councils) ? councils : [])
    : (Array.isArray(councils) ? councils : []).filter((c) => userCouncilIds.includes(c.id));

  // Backend already scopes by user's JWT — this is a flat endpoint
  const { data: rawData, isLoading } = useQuery({
    queryKey: ['decisions', page, pageSize],
    queryFn: () => apiClient.get<Decision[]>('/api/v1/decisions'),
  });

  // Client-side filtering for status/council/search since backend returns flat list
  const allDecisions = Array.isArray(rawData) ? rawData : (rawData as any)?.data || [];
  const filtered = allDecisions.filter((d: any) => {
    if (status && d.status !== status) return false;
    if (councilId && d.topic?.council?.id !== councilId) return false;
    if (search) {
      const s = search.toLowerCase();
      const match =
        d.refNumber?.toLowerCase().includes(s) ||
        d.summary?.toLowerCase().includes(s) ||
        d.topic?.title?.toLowerCase().includes(s);
      if (!match) return false;
    }
    return true;
  });
  const data = {
    data: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
  };

  const columns: ColumnsType<Decision> = [
    {
      title: 'رقم القرار',
      dataIndex: 'decisionNumber',
      key: 'decisionNumber',
      width: 130,
    },
    {
      title: 'نص القرار',
      dataIndex: 'body',
      key: 'body',
      ellipsis: true,
    },
    {
      title: 'الموضوع',
      dataIndex: ['topic', 'title'],
      key: 'topic',
      width: 200,
      ellipsis: true,
      render: (text: string, record: Decision) => (
        <a onClick={() => navigate(`/topics/${record.topicId}`)}>{text}</a>
      ),
    },
    {
      title: 'المجلس',
      dataIndex: ['council', 'name'],
      key: 'council',
      width: 140,
    },
    {
      title: 'تاريخ القرار',
      dataIndex: 'decidedAt',
      key: 'decidedAt',
      width: 120,
      render: (date: string) => dayjs(date).format('YYYY/MM/DD'),
    },
    {
      title: 'الحالة',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: DecisionStatus) => <StatusBadge status={s} />,
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        القرارات
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
          placeholder="الحالة"
          allowClear
          style={{ width: 140 }}
          value={status}
          onChange={(val) => {
            setStatus(val);
            setPage(1);
          }}
          options={statusOptions}
        />
        <Select
          placeholder="المجلس"
          allowClear
          style={{ width: 180 }}
          value={councilId}
          onChange={(val) => {
            setCouncilId(val);
            setPage(1);
          }}
          options={availableCouncils.map((c) => ({
            label: c.name,
            value: c.id,
          }))}
        />
      </Space>

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
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Typography, Select, Space, Empty, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuthStore, getUserCouncilIds, isGlobalRole } from '@/lib/auth';
import StatusBadge from '@/components/StatusBadge';
import type { Council, PaginatedResponse } from '@/types';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Title } = Typography;

interface MinutesRow {
  id: string;
  status: string;
  meetingId: string;
  meeting: {
    id: string;
    refNumber: string;
    title?: string;
    council: { id: string; name: string };
    scheduledAt?: string;
    heldAt?: string;
  };
  signedAt?: string;
  signedBy?: { displayName: string };
  createdAt: string;
}

export default function MinutesListPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const userCouncilIds = getUserCouncilIds(user);
  const global = isGlobalRole(user);
  const [selectedCouncilId, setSelectedCouncilId] = useState<string | undefined>(
    userCouncilIds.length === 1 ? userCouncilIds[0] : undefined,
  );

  const { data: councils } = useQuery({
    queryKey: ['councils'],
    queryFn: () => apiClient.get<Council[]>('/api/v1/councils'),
  });

  const availableCouncils = global
    ? (Array.isArray(councils) ? councils : [])
    : (Array.isArray(councils) ? councils : []).filter((c) => userCouncilIds.includes(c.id));

  const queryParams = new URLSearchParams();
  if (selectedCouncilId) queryParams.set('councilId', selectedCouncilId);
  queryParams.set('pageSize', '50');

  const { data, isLoading } = useQuery({
    queryKey: ['minutes-list', selectedCouncilId],
    queryFn: () =>
      apiClient.get<PaginatedResponse<MinutesRow>>(`/api/v1/meetings?${queryParams.toString()}`),
  });

  // Extract minutes from meetings that have them
  const meetings = data?.data || [];

  const columns: ColumnsType<MinutesRow> = [
    {
      title: 'رقم الاجتماع',
      key: 'refNumber',
      width: 140,
      render: (_: unknown, record: any) => record.refNumber || record.meeting?.refNumber,
    },
    {
      title: 'عنوان الاجتماع',
      key: 'title',
      render: (_: unknown, record: any) => (
        <a onClick={() => navigate(`/meetings/${record.id}`)}>
          {record.title || '—'}
        </a>
      ),
    },
    {
      title: 'المجلس',
      key: 'council',
      width: 150,
      render: (_: unknown, record: any) => record.council?.name,
    },
    {
      title: 'تاريخ الانعقاد',
      key: 'heldAt',
      width: 140,
      render: (_: unknown, record: any) => record.heldAt ? dayjs(record.heldAt).format('YYYY/MM/DD') : '—',
    },
    {
      title: 'حالة الاجتماع',
      key: 'status',
      width: 160,
      render: (_: unknown, record: any) => <StatusBadge status={record.status} />,
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>المحاضر</Title>
        <Space>
          {availableCouncils.length > 1 && (
            <Select
              placeholder="اختر المجلس"
              style={{ width: 200 }}
              allowClear
              value={selectedCouncilId}
              onChange={setSelectedCouncilId}
              options={availableCouncils.map((c) => ({ label: c.name, value: c.id }))}
            />
          )}
        </Space>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
      ) : meetings.length === 0 ? (
        <Empty description="لا توجد محاضر" />
      ) : (
        <Table
          columns={columns}
          dataSource={meetings}
          rowKey="id"
          pagination={{ pageSize: 20, showTotal: (t) => `الإجمالي: ${t}` }}
        />
      )}
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Select, Input, Space, Typography } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import StatusBadge from '@/components/StatusBadge';
import type { Topic, TopicStatus, Council, PaginatedResponse, RoleName } from '@/types';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Title } = Typography;

const statusOptions: { label: string; value: TopicStatus }[] = [
  { label: 'مسودة', value: 'DRAFT' },
  { label: 'بانتظار مدير الإدارة', value: 'PENDING_DEPT_MANAGER' },
  { label: 'معتمد من المدير', value: 'APPROVED_BY_MANAGER' },
  { label: 'مرفوض من المدير', value: 'REJECTED_BY_MANAGER' },
  { label: 'معاد للموظف', value: 'RETURNED_TO_STAFF' },
  { label: 'وارد الأمانة', value: 'INBOX_GS' },
  { label: 'قيد المراجعة', value: 'GS_REVIEW' },
  { label: 'معلق', value: 'SUSPENDED' },
  { label: 'محال للفحص', value: 'FORWARDED_TO_EXAM' },
  { label: 'في صندوق الأجندة', value: 'IN_AGENDA_BOX' },
  { label: 'مجدول', value: 'SCHEDULED' },
  { label: 'تم البت', value: 'DECIDED' },
];

export default function TopicsListPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [status, setStatus] = useState<TopicStatus | undefined>();
  const [councilId, setCouncilId] = useState<string | undefined>();
  const [search, setSearch] = useState('');

  const userRoles = user?.roles;
  const canCreate = userRoles?.some((r) =>
    (['DEPT_STAFF', 'DEPT_MANAGER'] as RoleName[]).includes(r.code),
  );

  const { data: councils } = useQuery({
    queryKey: ['councils'],
    queryFn: () => apiClient.get<Council[]>('/api/v1/councils'),
  });

  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('pageSize', String(pageSize));
  if (status) queryParams.set('status', status);
  if (councilId) queryParams.set('councilId', councilId);
  if (search) queryParams.set('search', search);

  const { data, isLoading } = useQuery({
    queryKey: ['topics', page, pageSize, status, councilId, search],
    queryFn: () =>
      apiClient.get<PaginatedResponse<Topic>>(`/api/v1/topics?${queryParams.toString()}`),
  });

  const columns: ColumnsType<Topic> = [
    {
      title: 'الرقم المرجعي',
      dataIndex: 'referenceNumber',
      key: 'referenceNumber',
      width: 150,
    },
    {
      title: 'العنوان',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (text: string, record: Topic) => (
        <a onClick={() => navigate(`/topics/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: 'المجلس',
      dataIndex: ['council', 'name'],
      key: 'council',
      width: 150,
    },
    {
      title: 'الحالة',
      dataIndex: 'status',
      key: 'status',
      width: 180,
      render: (s: TopicStatus) => <StatusBadge status={s} />,
    },
    {
      title: 'الإدارة',
      dataIndex: ['orgUnit', 'name'],
      key: 'orgUnit',
      width: 150,
    },
    {
      title: 'التاريخ',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date: string) => dayjs(date).format('YYYY/MM/DD'),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          المواضيع
        </Title>
        {canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/topics/new')}>
            إنشاء موضوع جديد
          </Button>
        )}
      </div>

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
          style={{ width: 180 }}
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
          options={(Array.isArray(councils) ? councils : []).map((c) => ({
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

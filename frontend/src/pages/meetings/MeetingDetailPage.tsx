import { useParams, useNavigate } from 'react-router-dom';
import { Descriptions, Card, Table, Typography, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';
import DynamicActionButtons from '@/components/DynamicActionButtons';
import type { Meeting, MeetingTopicLink } from '@/types';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: meeting, isLoading } = useQuery({
    queryKey: ['meeting', id],
    queryFn: () => apiClient.get<Meeting>(`/api/v1/meetings/${id}`),
    enabled: !!id,
  });

  const topicColumns: ColumnsType<MeetingTopicLink> = [
    { title: 'الترتيب', dataIndex: 'order', key: 'order', width: 80 },
    { title: 'الرقم المرجعي', dataIndex: ['topic', 'referenceNumber'], key: 'referenceNumber', width: 140 },
    {
      title: 'العنوان', dataIndex: ['topic', 'title'], key: 'title', ellipsis: true,
      render: (text: string, record: MeetingTopicLink) => (
        <a onClick={() => navigate(`/topics/${record.topicId}`)}>{text}</a>
      ),
    },
    { title: 'الحالة', dataIndex: ['topic', 'status'], key: 'status', width: 160, render: (s: string) => <StatusBadge status={s} /> },
  ];

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>;
  }

  if (!meeting) {
    return <div>الاجتماع غير موجود</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>{meeting.title}</Title>
        <StatusBadge status={meeting.status} />
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions bordered column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label="رقم الاجتماع">{meeting.meetingNumber || '-'}</Descriptions.Item>
          <Descriptions.Item label="المجلس">{meeting.council?.name}</Descriptions.Item>
          <Descriptions.Item label="التاريخ المجدول">
            {dayjs(meeting.scheduledDate).format('YYYY/MM/DD HH:mm')}
          </Descriptions.Item>
          <Descriptions.Item label="المكان">{meeting.location || '-'}</Descriptions.Item>
          <Descriptions.Item label="منشئ الاجتماع">{meeting.createdBy?.displayName}</Descriptions.Item>
          <Descriptions.Item label="تاريخ الإنشاء">
            {dayjs(meeting.createdAt).format('YYYY/MM/DD HH:mm')}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>الإجراءات المتاحة</Text>
        <DynamicActionButtons
          entityType="Meeting"
          entityId={id!}
          invalidateKeys={[['meeting', id!]]}
        />
      </Card>

      <Card title="المواضيع المرتبطة">
        <Table
          columns={topicColumns}
          dataSource={meeting.topicLinks || []}
          rowKey="id"
          pagination={false}
          locale={{ emptyText: 'لا توجد مواضيع مرتبطة' }}
        />
      </Card>
    </div>
  );
}

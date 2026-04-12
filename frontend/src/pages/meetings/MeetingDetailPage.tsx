import { useParams, useNavigate } from 'react-router-dom';
import { Descriptions, Card, Table, Button, Space, Typography, Spin, message } from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import StatusBadge from '@/components/StatusBadge';
import type { Meeting, MeetingTopicLink, RoleName, UserRoleBrief } from '@/types';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

function hasRole(roles: UserRoleBrief[] | undefined, codes: RoleName[]): boolean {
  if (!roles) return false;
  return roles.some((r) => codes.includes(r.code));
}

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const { data: meeting, isLoading } = useQuery({
    queryKey: ['meeting', id],
    queryFn: () => apiClient.get<Meeting>(`/api/v1/meetings/${id}`),
    enabled: !!id,
  });

  const transitionMutation = useMutation({
    mutationFn: (action: string) =>
      apiClient.post(`/api/v1/meetings/${id}/transition`, { action }),
    onSuccess: () => {
      message.success('تم تحديث حالة الاجتماع');
      queryClient.invalidateQueries({ queryKey: ['meeting', id] });
    },
    onError: (err: Error) => {
      message.error(err.message || 'فشل تحديث الحالة');
    },
  });

  const userRoles = user?.roles;
  const canManage = hasRole(userRoles, ['COUNCIL_SECRETARY', 'COUNCIL_PRESIDENT']);

  const topicColumns: ColumnsType<MeetingTopicLink> = [
    {
      title: 'الترتيب',
      dataIndex: 'order',
      key: 'order',
      width: 80,
    },
    {
      title: 'الرقم المرجعي',
      dataIndex: ['topic', 'referenceNumber'],
      key: 'referenceNumber',
      width: 140,
    },
    {
      title: 'العنوان',
      dataIndex: ['topic', 'title'],
      key: 'title',
      ellipsis: true,
      render: (text: string, record: MeetingTopicLink) => (
        <a onClick={() => navigate(`/topics/${record.topicId}`)}>{text}</a>
      ),
    },
    {
      title: 'الحالة',
      dataIndex: ['topic', 'status'],
      key: 'status',
      width: 160,
      render: (s: string) => <StatusBadge status={s} />,
    },
  ];

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!meeting) {
    return <div>الاجتماع غير موجود</div>;
  }

  const renderActions = () => {
    if (!canManage) return null;
    const actions: React.ReactNode[] = [];
    const status = meeting.status;

    if (status === 'DRAFT' || status === 'SCHEDULED') {
      actions.push(
        <Button
          key="start"
          type="primary"
          icon={<PlayCircleOutlined />}
          onClick={() => transitionMutation.mutate('start')}
          loading={transitionMutation.isPending}
        >
          بدء الجلسة
        </Button>,
      );
    }

    if (status === 'IN_SESSION') {
      actions.push(
        <Button
          key="adjourn"
          icon={<PauseCircleOutlined />}
          onClick={() => transitionMutation.mutate('adjourn')}
          loading={transitionMutation.isPending}
        >
          تأجيل
        </Button>,
        <Button
          key="end"
          type="primary"
          icon={<StopOutlined />}
          onClick={() => transitionMutation.mutate('end')}
          loading={transitionMutation.isPending}
        >
          إنهاء الجلسة
        </Button>,
      );
    }

    if (status === 'ENDED' && meeting.minutes) {
      actions.push(
        <Button
          key="minutes"
          icon={<FileTextOutlined />}
          onClick={() => navigate(`/minutes/${meeting.minutes!.id}`)}
        >
          عرض المحضر
        </Button>,
      );
    }

    if (status === 'ENDED' && !meeting.minutes) {
      actions.push(
        <Button
          key="create-minutes"
          type="primary"
          icon={<FileTextOutlined />}
          onClick={() => transitionMutation.mutate('create-minutes')}
          loading={transitionMutation.isPending}
        >
          إنشاء محضر
        </Button>,
      );
    }

    return actions.length > 0 ? <Space wrap>{actions}</Space> : null;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          {meeting.title}
        </Title>
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

      {renderActions() && (
        <Card style={{ marginBottom: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            الإجراءات
          </Text>
          {renderActions()}
        </Card>
      )}

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

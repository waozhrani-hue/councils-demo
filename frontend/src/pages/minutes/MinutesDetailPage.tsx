import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Button,
  Space,
  Typography,
  Spin,
  Input,
  List,
  Avatar,
  Tag,
  message,
} from 'antd';
import {
  EditOutlined,
  SaveOutlined,
  CheckOutlined,
  CloseOutlined,
  SendOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import StatusBadge from '@/components/StatusBadge';
import type { Minutes, MinuteMemberFeedback, RoleName, UserRoleBrief } from '@/types';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

function hasRole(roles: UserRoleBrief[] | undefined, codes: RoleName[]): boolean {
  if (!roles) return false;
  return roles.some((r) => codes.includes(r.code));
}

export default function MinutesDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [editing, setEditing] = useState(false);
  const [editedBody, setEditedBody] = useState('');

  const { data: minutes, isLoading } = useQuery({
    queryKey: ['minutes', id],
    queryFn: () => apiClient.get<Minutes>(`/api/v1/minutes/${id}`),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (body: string) => apiClient.patch(`/api/v1/minutes/${id}`, { body }),
    onSuccess: () => {
      message.success('تم حفظ المحضر');
      queryClient.invalidateQueries({ queryKey: ['minutes', id] });
      setEditing(false);
    },
    onError: (err: Error) => {
      message.error(err.message || 'فشل حفظ المحضر');
    },
  });

  const transitionMutation = useMutation({
    mutationFn: (action: string) =>
      apiClient.post(`/api/v1/minutes/${id}/transition`, { action }),
    onSuccess: () => {
      message.success('تم تحديث حالة المحضر');
      queryClient.invalidateQueries({ queryKey: ['minutes', id] });
    },
    onError: (err: Error) => {
      message.error(err.message || 'فشل تحديث الحالة');
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: (data: { approved: boolean; comment?: string }) =>
      apiClient.post(`/api/v1/minutes/${id}/feedback`, data),
    onSuccess: () => {
      message.success('تم تسجيل رأيك');
      queryClient.invalidateQueries({ queryKey: ['minutes', id] });
    },
    onError: (err: Error) => {
      message.error(err.message || 'فشل تسجيل الرأي');
    },
  });

  const userRoles = user?.roles;
  const canEdit = hasRole(userRoles, ['COUNCIL_SECRETARY']);
  const canTransition = hasRole(userRoles, ['COUNCIL_SECRETARY', 'COUNCIL_PRESIDENT', 'GENERAL_SECRETARY']);
  const canFeedback = hasRole(userRoles, ['COUNCIL_MEMBER', 'COUNCIL_PRESIDENT']);

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!minutes) {
    return <div>المحضر غير موجود</div>;
  }

  const startEdit = () => {
    setEditedBody(minutes.body);
    setEditing(true);
  };

  const renderActions = () => {
    const actions: React.ReactNode[] = [];
    const status = minutes.status;

    if (canEdit && status === 'DRAFT') {
      if (editing) {
        actions.push(
          <Button
            key="save"
            type="primary"
            icon={<SaveOutlined />}
            loading={updateMutation.isPending}
            onClick={() => updateMutation.mutate(editedBody)}
          >
            حفظ
          </Button>,
          <Button key="cancel" onClick={() => setEditing(false)}>
            إلغاء
          </Button>,
        );
      } else {
        actions.push(
          <Button key="edit" icon={<EditOutlined />} onClick={startEdit}>
            تعديل
          </Button>,
        );
      }
      actions.push(
        <Button
          key="submit"
          type="primary"
          icon={<SendOutlined />}
          onClick={() => transitionMutation.mutate('submit')}
          loading={transitionMutation.isPending}
        >
          إرسال للمراجعة
        </Button>,
      );
    }

    if (canTransition && status === 'PENDING_REVIEW') {
      actions.push(
        <Button
          key="approve"
          type="primary"
          icon={<CheckOutlined />}
          onClick={() => transitionMutation.mutate('approve')}
          loading={transitionMutation.isPending}
        >
          اعتماد
        </Button>,
        <Button
          key="reject"
          danger
          icon={<CloseOutlined />}
          onClick={() => transitionMutation.mutate('reject')}
          loading={transitionMutation.isPending}
        >
          رفض
        </Button>,
      );
    }

    if (canFeedback && (status === 'PENDING_REVIEW' || status === 'REVIEWED')) {
      const alreadyFed = minutes.feedbacks?.some((f) => f.userId === user?.id);
      if (!alreadyFed) {
        actions.push(
          <Button
            key="approve-fb"
            type="primary"
            icon={<CheckOutlined />}
            onClick={() => feedbackMutation.mutate({ approved: true })}
            loading={feedbackMutation.isPending}
          >
            موافق
          </Button>,
          <Button
            key="reject-fb"
            danger
            icon={<CloseOutlined />}
            onClick={() => feedbackMutation.mutate({ approved: false, comment: 'لدي ملاحظات' })}
            loading={feedbackMutation.isPending}
          >
            غير موافق
          </Button>,
        );
      }
    }

    return actions.length > 0 ? <Space wrap>{actions}</Space> : null;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          محضر الاجتماع
        </Title>
        <Space>
          <StatusBadge status={minutes.status} />
          <Button onClick={() => navigate(`/meetings/${minutes.meetingId}`)}>
            الرجوع للاجتماع
          </Button>
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions bordered column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label="الاجتماع">{minutes.meeting?.title}</Descriptions.Item>
          <Descriptions.Item label="المعد">{minutes.createdBy?.displayName}</Descriptions.Item>
          <Descriptions.Item label="تاريخ الإنشاء">
            {dayjs(minutes.createdAt).format('YYYY/MM/DD HH:mm')}
          </Descriptions.Item>
          <Descriptions.Item label="آخر تحديث">
            {dayjs(minutes.updatedAt).format('YYYY/MM/DD HH:mm')}
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

      <Card title="نص المحضر" style={{ marginBottom: 16 }}>
        {editing ? (
          <TextArea
            rows={12}
            value={editedBody}
            onChange={(e) => setEditedBody(e.target.value)}
          />
        ) : (
          <Paragraph style={{ whiteSpace: 'pre-wrap', minHeight: 200 }}>
            {minutes.body || 'لا يوجد نص بعد'}
          </Paragraph>
        )}
      </Card>

      <Card title="آراء الأعضاء">
        {minutes.feedbacks && minutes.feedbacks.length > 0 ? (
          <List
            dataSource={minutes.feedbacks}
            renderItem={(fb: MinuteMemberFeedback) => (
              <List.Item>
                <List.Item.Meta
                  avatar={<Avatar icon={<UserOutlined />} />}
                  title={
                    <Space>
                      <span>{fb.user?.displayName}</span>
                      <Tag color={fb.approved ? 'green' : 'red'}>
                        {fb.approved ? 'موافق' : 'غير موافق'}
                      </Tag>
                    </Space>
                  }
                  description={
                    <>
                      {fb.comment && <div>{fb.comment}</div>}
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {dayjs(fb.createdAt).format('YYYY/MM/DD HH:mm')}
                      </Text>
                    </>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <Text type="secondary">لا توجد آراء بعد</Text>
        )}
      </Card>
    </div>
  );
}

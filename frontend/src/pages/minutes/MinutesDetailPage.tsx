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
  UserOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import StatusBadge from '@/components/StatusBadge';
import DynamicActionButtons from '@/components/DynamicActionButtons';
import { usePermissions } from '@/hooks/usePermissions';
import type { Minutes, MinuteMemberFeedback } from '@/types';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export default function MinutesDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [editing, setEditing] = useState(false);
  const [editedBody, setEditedBody] = useState('');
  const { hasPermission } = usePermissions();

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
    onError: (err: Error) => message.error(err.message || 'فشل حفظ المحضر'),
  });

  const feedbackMutation = useMutation({
    mutationFn: (data: { approved: boolean; comment?: string }) =>
      apiClient.post(`/api/v1/minutes/${id}/feedback`, data),
    onSuccess: () => {
      message.success('تم تسجيل رأيك');
      queryClient.invalidateQueries({ queryKey: ['minutes', id] });
    },
    onError: (err: Error) => message.error(err.message || 'فشل تسجيل الرأي'),
  });

  const canEdit = hasPermission('EDIT_MINUTES');
  const canFeedback = hasPermission('VIEW_MINUTES'); // members who can view can give feedback

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>;
  }

  if (!minutes) {
    return <div>المحضر غير موجود</div>;
  }

  const startEdit = () => {
    setEditedBody(minutes.body);
    setEditing(true);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>محضر الاجتماع</Title>
        <Space>
          <StatusBadge status={minutes.status} />
          <Button onClick={() => navigate(`/meetings/${minutes.meetingId}`)}>الرجوع للاجتماع</Button>
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions bordered column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label="الاجتماع">{minutes.meeting?.title}</Descriptions.Item>
          <Descriptions.Item label="المعد">{minutes.createdBy?.displayName}</Descriptions.Item>
          <Descriptions.Item label="تاريخ الإنشاء">{dayjs(minutes.createdAt).format('YYYY/MM/DD HH:mm')}</Descriptions.Item>
          <Descriptions.Item label="آخر تحديث">{dayjs(minutes.updatedAt).format('YYYY/MM/DD HH:mm')}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>الإجراءات المتاحة</Text>
        <Space wrap>
          {canEdit && (minutes.status === 'MIN_DRAFT' || minutes.status === 'MIN_GS_RETURNED') && (
            editing ? (
              <>
                <Button type="primary" icon={<SaveOutlined />} loading={updateMutation.isPending}
                  onClick={() => updateMutation.mutate(editedBody)}>حفظ</Button>
                <Button onClick={() => setEditing(false)}>إلغاء</Button>
              </>
            ) : (
              <Button icon={<EditOutlined />} onClick={startEdit}>تعديل المحضر</Button>
            )
          )}
          <DynamicActionButtons
            entityType="Minutes"
            entityId={id!}
            invalidateKeys={[['minutes', id!]]}
          />
        </Space>
      </Card>

      {canFeedback && minutes.status === 'MIN_MEMBERS_CONSULT' && (
        <Card style={{ marginBottom: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>رأيك في المحضر</Text>
          {minutes.feedbacks?.some((f: any) => f.memberId === user?.id || f.userId === user?.id) ? (
            <Text type="secondary">تم تسجيل رأيك مسبقاً</Text>
          ) : (
            <Space>
              <Button type="primary" icon={<CheckOutlined />} loading={feedbackMutation.isPending}
                onClick={() => feedbackMutation.mutate({ approved: true })}>موافق</Button>
              <Button danger icon={<CloseOutlined />} loading={feedbackMutation.isPending}
                onClick={() => feedbackMutation.mutate({ approved: false, comment: 'لدي ملاحظات' })}>غير موافق</Button>
            </Space>
          )}
        </Card>
      )}

      <Card title="نص المحضر" style={{ marginBottom: 16 }}>
        {editing ? (
          <TextArea rows={12} value={editedBody} onChange={(e) => setEditedBody(e.target.value)} />
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
                      <Tag color={fb.approved ? 'green' : 'red'}>{fb.approved ? 'موافق' : 'غير موافق'}</Tag>
                    </Space>
                  }
                  description={
                    <>
                      {fb.comment && <div>{fb.comment}</div>}
                      <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(fb.createdAt).format('YYYY/MM/DD HH:mm')}</Text>
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

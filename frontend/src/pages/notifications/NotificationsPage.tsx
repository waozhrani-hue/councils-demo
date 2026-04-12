import { useNavigate } from 'react-router-dom';
import { List, Typography, Button, Space, Spin, Empty, message } from 'antd';
import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { Notification } from '@/types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiClient.get<Notification[]>('/api/v1/notifications'),
  });

  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) =>
      apiClient.patch(`/api/v1/notifications/${notificationId}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiClient.post('/api/v1/notifications/mark-all-read'),
    onSuccess: () => {
      message.success('تم تحديد الكل كمقروء');
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  const handleClick = (notification: Notification) => {
    if (!notification.isRead) {
      markReadMutation.mutate(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const items = Array.isArray(notifications) ? notifications : [];
  const unreadCount = items.filter((n) => !n.isRead).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Title level={4} style={{ margin: 0 }}>
            الإشعارات
          </Title>
          {unreadCount > 0 && (
            <Text type="secondary">({unreadCount} غير مقروء)</Text>
          )}
        </Space>
        {unreadCount > 0 && (
          <Button
            icon={<CheckOutlined />}
            onClick={() => markAllReadMutation.mutate()}
            loading={markAllReadMutation.isPending}
          >
            تحديد الكل كمقروء
          </Button>
        )}
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : items.length === 0 ? (
        <Empty description="لا توجد إشعارات" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          dataSource={items}
          renderItem={(notification: Notification) => (
            <div
              className={`notification-item ${notification.isRead ? '' : 'unread'}`}
              onClick={() => handleClick(notification)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <BellOutlined style={{ color: notification.isRead ? '#999' : '#1677ff' }} />
                    <Text strong={!notification.isRead}>{notification.title}</Text>
                  </div>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    {notification.message}
                  </Text>
                </div>
                <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap', marginRight: 16 }}>
                  {dayjs(notification.createdAt).format('YYYY/MM/DD HH:mm')}
                </Text>
              </div>
            </div>
          )}
        />
      )}
    </div>
  );
}

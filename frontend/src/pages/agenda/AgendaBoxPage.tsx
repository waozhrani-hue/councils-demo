import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { List, Card, Button, Select, Typography, Space, message, Spin, Empty } from 'antd';
import { CalendarOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuthStore, getUserCouncilIds, isGlobalRole } from '@/lib/auth';
import StatusBadge from '@/components/StatusBadge';
import type { Topic, Council, PaginatedResponse } from '@/types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function AgendaBoxPage() {
  const { councilId: paramCouncilId } = useParams<{ councilId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const userCouncilIds = getUserCouncilIds(user);
  const global = isGlobalRole(user);

  // Auto-select council: use URL param, then user's first council
  const [selectedCouncilId, setSelectedCouncilId] = useState<string | undefined>(
    paramCouncilId || (userCouncilIds.length === 1 ? userCouncilIds[0] : undefined),
  );
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

  const councilId = selectedCouncilId || paramCouncilId;

  // Auto-select when user has exactly one council and nothing is selected
  useEffect(() => {
    if (!councilId && userCouncilIds.length === 1) {
      setSelectedCouncilId(userCouncilIds[0]);
    }
  }, [councilId, userCouncilIds]);

  const { data: councils } = useQuery({
    queryKey: ['councils'],
    queryFn: () => apiClient.get<Council[]>('/api/v1/councils'),
  });

  const availableCouncils = global
    ? (Array.isArray(councils) ? councils : [])
    : (Array.isArray(councils) ? councils : []).filter((c) => userCouncilIds.includes(c.id));

  const queryParams = new URLSearchParams();
  queryParams.set('statuses', 'IN_AGENDA_BOX');
  if (councilId) queryParams.set('councilId', councilId);
  queryParams.set('pageSize', '100');

  const { data, isLoading } = useQuery({
    queryKey: ['agenda-topics', councilId],
    queryFn: () =>
      apiClient.get<PaginatedResponse<Topic>>(`/api/v1/topics?${queryParams.toString()}`),
    enabled: !!councilId,
  });

  const topics = data?.data || [];

  const reorderMutation = useMutation({
    mutationFn: (orderedTopicIds: string[]) =>
      apiClient.patch(`/api/v1/councils/${councilId}/agenda-box/reorder`, { orderedTopicIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-topics'] });
    },
  });

  const handleReorder = (topicId: string, direction: 'up' | 'down') => {
    const idx = topics.findIndex((t) => t.id === topicId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= topics.length) return;
    const newOrder = topics.map((t) => t.id);
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    reorderMutation.mutate(newOrder);
  };

  const linkToMeetingMutation = useMutation({
    mutationFn: (topicIds: string[]) =>
      apiClient.post(`/api/v1/councils/${councilId}/meetings`, {
        title: `اجتماع ${dayjs().format('YYYY/MM/DD')}`,
        topicIds,
      }),
    onSuccess: () => {
      message.success('تم إنشاء اجتماع وربط المواضيع');
      queryClient.invalidateQueries({ queryKey: ['agenda-topics'] });
      setSelectedTopics([]);
    },
    onError: (err: Error) => {
      message.error(err.message || 'فشل ربط المواضيع');
    },
  });

  const toggleSelection = (topicId: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topicId) ? prev.filter((id) => id !== topicId) : [...prev, topicId],
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          صندوق الأجندة
        </Title>
        <Space>
          <Select
            placeholder="اختر المجلس"
            style={{ width: 200 }}
            value={councilId}
            onChange={setSelectedCouncilId}
            options={availableCouncils.map((c) => ({
              label: c.name,
              value: c.id,
            }))}
          />
          {selectedTopics.length > 0 && (
            <Button
              type="primary"
              icon={<CalendarOutlined />}
              loading={linkToMeetingMutation.isPending}
              onClick={() => linkToMeetingMutation.mutate(selectedTopics)}
            >
              ربط بالاجتماع ({selectedTopics.length})
            </Button>
          )}
        </Space>
      </div>

      {!councilId ? (
        <Empty description="اختر المجلس لعرض المواضيع" />
      ) : isLoading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : topics.length === 0 ? (
        <Empty description="لا توجد مواضيع في صندوق الأجندة" />
      ) : (
        <List
          dataSource={topics}
          renderItem={(topic, index) => (
            <Card
              size="small"
              style={{
                marginBottom: 8,
                cursor: 'pointer',
                border: selectedTopics.includes(topic.id) ? '2px solid #1677ff' : undefined,
              }}
              onClick={() => toggleSelection(topic.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Text strong style={{ fontSize: 14 }}>
                      {index + 1}. {topic.title}
                    </Text>
                    <StatusBadge status={topic.status} />
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {topic.referenceNumber} | {topic.council?.name} |{' '}
                    {dayjs(topic.createdAt).format('YYYY/MM/DD')}
                  </Text>
                </div>
                <Space>
                  <Button
                    size="small"
                    icon={<ArrowUpOutlined />}
                    disabled={index === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReorder(topic.id, 'up');
                    }}
                  />
                  <Button
                    size="small"
                    icon={<ArrowDownOutlined />}
                    disabled={index === topics.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReorder(topic.id, 'down');
                    }}
                  />
                  <Button
                    size="small"
                    type="link"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/topics/${topic.id}`);
                    }}
                  >
                    التفاصيل
                  </Button>
                </Space>
              </div>
            </Card>
          )}
        />
      )}
    </div>
  );
}

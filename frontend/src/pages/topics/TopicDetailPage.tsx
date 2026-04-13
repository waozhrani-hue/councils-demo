import { useParams } from 'react-router-dom';
import {
  Descriptions,
  Card,
  Timeline,
  List,
  Typography,
  Spin,
} from 'antd';
import {
  FileOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';
import DynamicActionButtons from '@/components/DynamicActionButtons';
import type { Topic } from '@/types';
import dayjs from 'dayjs';
import { Button } from 'antd';

const { Title, Text } = Typography;

export default function TopicDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: topic, isLoading } = useQuery({
    queryKey: ['topic', id],
    queryFn: () => apiClient.get<Topic>(`/api/v1/topics/${id}`),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!topic) {
    return <div>الموضوع غير موجود</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          {topic.title}
        </Title>
        <StatusBadge status={topic.status} />
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions bordered column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label="الرقم المرجعي">{(topic as any).refNumber || topic.referenceNumber}</Descriptions.Item>
          <Descriptions.Item label="المجلس">{topic.council?.name}</Descriptions.Item>
          <Descriptions.Item label="الجهة الطالبة">{(topic as any).requestingOrg?.name || topic.orgUnit?.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="مستوى السرية">{topic.secrecyLevel?.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="مقدم الموضوع">{topic.createdBy?.displayName}</Descriptions.Item>
          <Descriptions.Item label="تاريخ الإنشاء">
            {dayjs(topic.createdAt).format('YYYY/MM/DD HH:mm')}
          </Descriptions.Item>
          {topic.body && (
            <Descriptions.Item label="التفاصيل" span={2}>
              <div style={{ whiteSpace: 'pre-wrap' }}>{topic.body}</div>
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          الإجراءات المتاحة
        </Text>
        <DynamicActionButtons
          entityType="Topic"
          entityId={id!}
          invalidateKeys={[['topic', id!]]}
        />
      </Card>

      {topic.attachments && topic.attachments.length > 0 && (
        <Card title="المرفقات" style={{ marginBottom: 16 }}>
          <List
            dataSource={topic.attachments}
            renderItem={(att) => (
              <List.Item
                actions={[
                  <Button
                    key="download"
                    type="link"
                    icon={<DownloadOutlined />}
                    href={`/api/v1/topics/${id}/attachments/${att.id}/download`}
                    target="_blank"
                  >
                    تحميل
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={<FileOutlined style={{ fontSize: 24 }} />}
                  title={att.fileName}
                  description={`${(att.fileSize / 1024).toFixed(1)} ك.ب`}
                />
              </List.Item>
            )}
          />
        </Card>
      )}

      <Card title="سجل الحالات" className="status-timeline">
        <Timeline
          mode="right"
          items={(topic.statusLogs || []).map((log: any) => ({
            children: (
              <div>
                <div>
                  {log.fromStatus && <StatusBadge status={log.fromStatus} />}
                  {log.fromStatus && ' ← '}
                  <StatusBadge status={log.toStatus} />
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {log.actor?.displayName || log.changedBy?.displayName} - {dayjs(log.createdAt).format('YYYY/MM/DD HH:mm')}
                </Text>
                {log.reason && (
                  <div>
                    <Text type="secondary">السبب: {log.reason}</Text>
                  </div>
                )}
              </div>
            ),
          }))}
        />
      </Card>
    </div>
  );
}

import { useState, useMemo } from 'react';
import { Row, Col, Card, Statistic, Select, DatePicker, Progress, Space, Spin, Typography, Tag } from 'antd';
import {
  FileTextOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  RollbackOutlined,
  BankOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuthStore, getUserCouncilIds, isGlobalRole } from '@/lib/auth';
import type { Council } from '@/types';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Title } = Typography;

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'مسودة',
  PENDING_DEPT_MGR: 'بانتظار مدير الإدارة',
  APPROVED: 'معتمد من المدير',
  SENT_TO_GS: 'مرسل للأمين العام',
  INBOX_GS: 'وارد الأمين العام',
  GS_REVIEW: 'قيد مراجعة الأمين',
  SUSPENDED: 'معلّق',
  RETURNED_DEPT: 'معاد للإدارة',
  CLOSED_BY_DEPT: 'مغلق من الإدارة',
  WITH_COUNCIL: 'لدى المجلس',
  EXAM_IN_PROGRESS: 'الفحص جارٍ',
  EXAM_COMPLETE: 'الفحص مكتمل',
  EXAM_INCOMPLETE: 'الفحص ناقص',
  PRESIDENT_REVIEW: 'مراجعة الرئيس',
  RETURNED_COUNCIL: 'معاد من المجلس',
  IN_AGENDA_BOX: 'في صندوق الأجندة',
  LINKED_TO_MEETING: 'مرتبط باجتماع',
  DEFERRED_IN_SESSION: 'مؤجل في الجلسة',
  DISCUSSED: 'تمت المناقشة',
  DECISION_PENDING: 'بانتظار القرار',
  DECISION_ISSUED: 'صدر القرار',
  NOTIFIED: 'تم التبليغ',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#d9d9d9',
  PENDING_DEPT_MGR: '#faad14',
  APPROVED: '#52c41a',
  SENT_TO_GS: '#1677ff',
  INBOX_GS: '#722ed1',
  GS_REVIEW: '#9254de',
  SUSPENDED: '#fa8c16',
  RETURNED_DEPT: '#ff4d4f',
  CLOSED_BY_DEPT: '#8c8c8c',
  WITH_COUNCIL: '#13c2c2',
  EXAM_IN_PROGRESS: '#2f54eb',
  EXAM_COMPLETE: '#52c41a',
  EXAM_INCOMPLETE: '#ff7a45',
  PRESIDENT_REVIEW: '#eb2f96',
  RETURNED_COUNCIL: '#ff4d4f',
  IN_AGENDA_BOX: '#1890ff',
  LINKED_TO_MEETING: '#13c2c2',
  DEFERRED_IN_SESSION: '#faad14',
  DISCUSSED: '#52c41a',
  DECISION_PENDING: '#722ed1',
  DECISION_ISSUED: '#389e0d',
  NOTIFIED: '#237804',
};

interface StatusItem {
  status: string;
  count: number;
}

interface DeptItem {
  orgId: string;
  orgName: string;
  count: number;
}

interface CouncilItem {
  councilId: string;
  councilName: string;
  topics: number;
  decisions: number;
}

interface DashboardStats {
  topicsCount: number;
  meetingsCount: number;
  decisionsCount: number;
  returnsCount: number;
  statusBreakdown: StatusItem[];
  departmentsBreakdown: DeptItem[];
  councilBreakdown: CouncilItem[];
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [councilId, setCouncilId] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  const { data: councils } = useQuery({
    queryKey: ['councils'],
    queryFn: () => apiClient.get<Council[]>('/api/v1/councils'),
  });

  // Filter councils dropdown to user's scoped councils
  const availableCouncils = useMemo(() => {
    const all = Array.isArray(councils) ? councils : [];
    if (isGlobalRole(user)) return all;
    const ids = getUserCouncilIds(user);
    return ids.length > 0 ? all.filter((c) => ids.includes(c.id)) : all;
  }, [councils, user]);

  const queryParams = new URLSearchParams();
  if (councilId) queryParams.set('councilId', councilId);
  if (dateRange?.[0]) queryParams.set('fromDate', dateRange[0].toISOString());
  if (dateRange?.[1]) queryParams.set('toDate', dateRange[1].toISOString());

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats', councilId, dateRange?.[0]?.toISOString(), dateRange?.[1]?.toISOString()],
    queryFn: () =>
      apiClient.get<DashboardStats>(
        `/api/v1/dashboard/stats${queryParams.toString() ? '?' + queryParams.toString() : ''}`,
      ),
  });

  const statusBreakdown = stats?.statusBreakdown ?? [];
  const deptBreakdown = stats?.departmentsBreakdown ?? [];
  const councilBreakdown = stats?.councilBreakdown ?? [];
  const totalTopics = statusBreakdown.reduce((a, b) => a + b.count, 0) || 1;

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0, flex: 1 }}>
          لوحة المعلومات
        </Title>
        <Space wrap>
          <Select
            placeholder="اختر المجلس"
            allowClear
            style={{ width: 200 }}
            onChange={setCouncilId}
            value={councilId}
            options={availableCouncils.map((c) => ({
              label: c.name,
              value: c.id,
            }))}
          />
          <RangePicker
            onChange={(dates) => setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null)}
            placeholder={['من تاريخ', 'إلى تاريخ']}
          />
        </Space>
      </div>

      <Spin spinning={isLoading}>
        {/* ── الإحصائيات الرئيسية ── */}
        <Row gutter={[16, 16]} className="dashboard-stats">
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="المواضيع"
                value={stats?.topicsCount ?? 0}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#1677ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="الاجتماعات"
                value={stats?.meetingsCount ?? 0}
                prefix={<TeamOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="القرارات"
                value={stats?.decisionsCount ?? 0}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="المعادات"
                value={stats?.returnsCount ?? 0}
                prefix={<RollbackOutlined />}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
        </Row>

        {/* ── توزيع المواضيع حسب الحالة + الإدارات ── */}
        <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
          <Col xs={24} lg={12}>
            <Card title="توزيع المواضيع حسب الحالة" style={{ height: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {statusBreakdown.length > 0 ? (
                  statusBreakdown
                    .sort((a, b) => b.count - a.count)
                    .map(({ status, count }) => (
                      <div key={status}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontSize: 13 }}>
                            <Tag color={STATUS_COLORS[status] ?? '#1677ff'} style={{ marginLeft: 4 }}>
                              {count}
                            </Tag>
                            {STATUS_LABELS[status] ?? status}
                          </span>
                        </div>
                        <Progress
                          percent={Math.round((count / totalTopics) * 100)}
                          showInfo={false}
                          strokeColor={STATUS_COLORS[status] ?? '#1677ff'}
                          size="small"
                        />
                      </div>
                    ))
                ) : (
                  <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>
                    لا توجد بيانات
                  </div>
                )}
              </div>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card
              title={
                <Space>
                  <ApartmentOutlined />
                  <span>توزيع المواضيع حسب الإدارة</span>
                </Space>
              }
              style={{ height: '100%' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {deptBreakdown.length > 0 ? (
                  deptBreakdown.map(({ orgName, count }) => (
                    <div
                      key={orgName}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 0',
                        borderBottom: '1px solid #f0f0f0',
                      }}
                    >
                      <span>{orgName}</span>
                      <Tag color="blue">{count}</Tag>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>
                    لا توجد بيانات
                  </div>
                )}
              </div>
            </Card>
          </Col>
        </Row>

        {/* ── توزيع حسب المجالس ── */}
        <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
          <Col xs={24}>
            <Card
              title={
                <Space>
                  <BankOutlined />
                  <span>توزيع حسب المجالس</span>
                </Space>
              }
            >
              <Row gutter={[16, 16]}>
                {councilBreakdown.length > 0 ? (
                  councilBreakdown.map(({ councilName, topics, decisions }) => (
                    <Col xs={24} sm={12} md={8} lg={4} key={councilName}>
                      <Card size="small" style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>{councilName}</div>
                        <Space size="large">
                          <Statistic
                            title="مواضيع"
                            value={topics}
                            valueStyle={{ fontSize: 18, color: '#1677ff' }}
                          />
                          <Statistic
                            title="قرارات"
                            value={decisions}
                            valueStyle={{ fontSize: 18, color: '#722ed1' }}
                          />
                        </Space>
                      </Card>
                    </Col>
                  ))
                ) : (
                  <Col xs={24}>
                    <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>
                      لا توجد بيانات
                    </div>
                  </Col>
                )}
              </Row>
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
}

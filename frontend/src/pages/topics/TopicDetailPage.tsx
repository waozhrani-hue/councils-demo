import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Descriptions,
  Card,
  Timeline,
  Button,
  Space,
  Modal,
  Input,
  Select,
  List,
  Typography,
  Spin,
  message,
  Divider,
} from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  RollbackOutlined,
  PauseCircleOutlined,
  SendOutlined,
  FileOutlined,
  DownloadOutlined,
  ExperimentOutlined,
  PlayCircleOutlined,
  StopOutlined,
  ScheduleOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import StatusBadge from '@/components/StatusBadge';
import type { Topic, TopicStatusLog, RoleName, UserRoleBrief } from '@/types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

function hasRole(roles: UserRoleBrief[] | undefined, codes: RoleName[]): boolean {
  if (!roles) return false;
  return roles.some((r) => codes.includes(r.code));
}

export default function TopicDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [reasonModal, setReasonModal] = useState<{
    action: string;
    visible: boolean;
    needsReturnType?: boolean;
  }>({
    action: '',
    visible: false,
  });
  const [reason, setReason] = useState('');
  const [returnType, setReturnType] = useState<string>('');

  const { data: topic, isLoading } = useQuery({
    queryKey: ['topic', id],
    queryFn: () => apiClient.get<Topic>(`/api/v1/topics/${id}`),
    enabled: !!id,
  });

  const transitionMutation = useMutation({
    mutationFn: (data: { action: string; reason?: string; returnType?: string }) =>
      apiClient.post(`/api/v1/topics/${id}/transition`, data),
    onSuccess: () => {
      message.success('تم تحديث حالة الموضوع');
      queryClient.invalidateQueries({ queryKey: ['topic', id] });
      setReasonModal({ action: '', visible: false });
      setReason('');
      setReturnType('');
    },
    onError: (err: Error) => {
      message.error(err.message || 'فشل تحديث الحالة');
    },
  });

  // Actions that require a reason modal
  const REASON_ACTIONS = [
    'RETURN_TO_DRAFT', 'REJECT', 'RETURN_WRONG_COUNCIL', 'SUSPEND',
    'EXAM_FAIL', 'RETURN_TO_COUNCIL',
  ];

  const doTransition = (action: string, needsReturnType = false) => {
    if (REASON_ACTIONS.includes(action)) {
      setReasonModal({ action, visible: true, needsReturnType });
    } else {
      transitionMutation.mutate({ action });
    }
  };

  const confirmReasonAction = () => {
    if (!reason.trim()) {
      message.warning('يرجى إدخال السبب');
      return;
    }
    if (reasonModal.needsReturnType && !returnType) {
      message.warning('يرجى اختيار نوع الإعادة');
      return;
    }
    transitionMutation.mutate({
      action: reasonModal.action,
      reason,
      returnType: returnType || undefined,
    });
  };

  const userRoles = user?.roles;
  const status = topic?.status;

  const renderActions = () => {
    const actions: React.ReactNode[] = [];

    // ══════════════════════════════════════════════
    // DRAFT → DEPT_STAFF: Submit to manager
    // ══════════════════════════════════════════════
    if (status === 'DRAFT' && hasRole(userRoles, ['DEPT_STAFF', 'DEPT_MANAGER'])) {
      actions.push(
        <Button key="submit" type="primary" icon={<SendOutlined />}
          onClick={() => doTransition('SUBMIT_TO_MANAGER')}>
          إرسال للمدير
        </Button>,
      );
    }

    // ══════════════════════════════════════════════
    // PENDING_DEPT_MGR → DEPT_MANAGER: Approve / Return
    // ══════════════════════════════════════════════
    if (status === 'PENDING_DEPT_MGR' && hasRole(userRoles, ['DEPT_MANAGER'])) {
      actions.push(
        <Button key="approve" type="primary" icon={<CheckOutlined />}
          onClick={() => doTransition('APPROVE')}>
          اعتماد
        </Button>,
        <Button key="return" icon={<RollbackOutlined />}
          onClick={() => doTransition('RETURN_TO_DRAFT')}>
          إعادة للمسودة
        </Button>,
      );
    }

    // ══════════════════════════════════════════════
    // APPROVED → DEPT_MANAGER: Send to GS / Revoke
    // ══════════════════════════════════════════════
    if (status === 'APPROVED' && hasRole(userRoles, ['DEPT_MANAGER'])) {
      actions.push(
        <Button key="send-gs" type="primary" icon={<SendOutlined />}
          onClick={() => doTransition('SEND_TO_GS')}>
          إرسال للأمين العام
        </Button>,
        <Button key="revoke" danger icon={<UndoOutlined />}
          onClick={() => doTransition('REVOKE_APPROVAL')}>
          سحب الاعتماد
        </Button>,
      );
    }

    // ══════════════════════════════════════════════
    // RETURNED_DEPT → DEPT_MANAGER: Resubmit / Close
    // ══════════════════════════════════════════════
    if (status === 'RETURNED_DEPT' && hasRole(userRoles, ['DEPT_MANAGER'])) {
      actions.push(
        <Button key="resubmit" type="primary" icon={<SendOutlined />}
          onClick={() => doTransition('RESUBMIT')}>
          إعادة الإرسال
        </Button>,
        <Button key="close" danger icon={<StopOutlined />}
          onClick={() => doTransition('CLOSE_BY_DEPT')}>
          إغلاق الموضوع
        </Button>,
      );
    }

    // ══════════════════════════════════════════════
    // GS_REVIEW → GENERAL_SECRETARY: Accept / Suspend / Reject / Return wrong council
    // ══════════════════════════════════════════════
    if (
      (status === 'INBOX_GS' || status === 'GS_REVIEW') &&
      hasRole(userRoles, ['GENERAL_SECRETARY'])
    ) {
      actions.push(
        <Button key="accept" type="primary" icon={<CheckOutlined />}
          onClick={() => doTransition('ACCEPT')}>
          قبول وتحويل للمجلس
        </Button>,
        <Button key="suspend" icon={<PauseCircleOutlined />}
          onClick={() => doTransition('SUSPEND')}>
          تعليق
        </Button>,
        <Button key="return-wrong" icon={<RollbackOutlined />}
          onClick={() => doTransition('RETURN_WRONG_COUNCIL')}>
          إعادة (مجلس خاطئ)
        </Button>,
        <Button key="reject" danger icon={<CloseOutlined />}
          onClick={() => doTransition('REJECT')}>
          رفض
        </Button>,
      );
    }

    // ══════════════════════════════════════════════
    // SUSPENDED → GENERAL_SECRETARY: Resume
    // ══════════════════════════════════════════════
    if (status === 'SUSPENDED' && hasRole(userRoles, ['GENERAL_SECRETARY'])) {
      actions.push(
        <Button key="resume" type="primary" icon={<PlayCircleOutlined />}
          onClick={() => doTransition('RESUME')}>
          استئناف المراجعة
        </Button>,
      );
    }

    // ══════════════════════════════════════════════
    // WITH_COUNCIL → COUNCIL_SECRETARY: Assign examination
    // ══════════════════════════════════════════════
    if (status === 'WITH_COUNCIL' && hasRole(userRoles, ['COUNCIL_SECRETARY'])) {
      actions.push(
        <Button key="assign-exam" type="primary" icon={<ExperimentOutlined />}
          onClick={() => doTransition('ASSIGN_EXAM')}>
          إحالة للفحص
        </Button>,
      );
    }

    // ══════════════════════════════════════════════
    // EXAM_IN_PROGRESS → EXAM_OFFICER: Pass / Fail
    // ══════════════════════════════════════════════
    if (status === 'EXAM_IN_PROGRESS' && hasRole(userRoles, ['EXAM_OFFICER'])) {
      actions.push(
        <Button key="exam-pass" type="primary" icon={<CheckOutlined />}
          onClick={() => doTransition('EXAM_PASS')}>
          فحص مكتمل
        </Button>,
        <Button key="exam-fail" danger icon={<CloseOutlined />}
          onClick={() => doTransition('EXAM_FAIL')}>
          فحص غير مكتمل
        </Button>,
      );
    }

    // ══════════════════════════════════════════════
    // EXAM_INCOMPLETE → COUNCIL_SECRETARY: Re-examine
    // ══════════════════════════════════════════════
    if (status === 'EXAM_INCOMPLETE' && hasRole(userRoles, ['COUNCIL_SECRETARY'])) {
      actions.push(
        <Button key="reexam" type="primary" icon={<ExperimentOutlined />}
          onClick={() => doTransition('REEXAM')}>
          إعادة الفحص
        </Button>,
      );
    }

    // ══════════════════════════════════════════════
    // EXAM_COMPLETE → COUNCIL_SECRETARY: Submit to president
    // ══════════════════════════════════════════════
    if (status === 'EXAM_COMPLETE' && hasRole(userRoles, ['COUNCIL_SECRETARY'])) {
      actions.push(
        <Button key="to-president" type="primary" icon={<SendOutlined />}
          onClick={() => doTransition('SUBMIT_TO_PRESIDENT')}>
          رفع لرئيس المجلس
        </Button>,
      );
    }

    // ══════════════════════════════════════════════
    // PRESIDENT_REVIEW → COUNCIL_PRESIDENT: Mark suitable / Return
    // ══════════════════════════════════════════════
    if (status === 'PRESIDENT_REVIEW' && hasRole(userRoles, ['COUNCIL_PRESIDENT'])) {
      actions.push(
        <Button key="suitable" type="primary" icon={<CheckOutlined />}
          onClick={() => doTransition('MARK_SUITABLE')}>
          مناسب للإدراج
        </Button>,
        <Button key="return-council" icon={<RollbackOutlined />}
          onClick={() => doTransition('RETURN_TO_COUNCIL', true)}>
          إعادة للمجلس
        </Button>,
      );
    }

    // ══════════════════════════════════════════════
    // RETURNED_COUNCIL → COUNCIL_SECRETARY: Reexam or resubmit based on returnType
    // ══════════════════════════════════════════════
    if (status === 'RETURNED_COUNCIL' && hasRole(userRoles, ['COUNCIL_SECRETARY'])) {
      const rt = (topic as any)?.returnType;
      if (rt === 'FULL_REEXAM') {
        actions.push(
          <Button key="reexam-return" type="primary" icon={<ExperimentOutlined />}
            onClick={() => doTransition('REEXAM')}>
            إعادة الفحص الكامل
          </Button>,
        );
      } else if (rt === 'PATH_CORRECTION') {
        actions.push(
          <Button key="resubmit-pres" type="primary" icon={<SendOutlined />}
            onClick={() => doTransition('SUBMIT_TO_PRESIDENT')}>
            إعادة الرفع لرئيس المجلس
          </Button>,
        );
      } else {
        // Show both if returnType is unknown
        actions.push(
          <Button key="reexam-return" icon={<ExperimentOutlined />}
            onClick={() => doTransition('REEXAM')}>
            إعادة الفحص
          </Button>,
          <Button key="resubmit-pres" icon={<SendOutlined />}
            onClick={() => doTransition('SUBMIT_TO_PRESIDENT')}>
            إعادة الرفع للرئيس
          </Button>,
        );
      }
    }

    // ══════════════════════════════════════════════
    // IN_AGENDA_BOX → COUNCIL_SECRETARY: Link to meeting
    // ══════════════════════════════════════════════
    if (status === 'IN_AGENDA_BOX' && hasRole(userRoles, ['COUNCIL_SECRETARY'])) {
      actions.push(
        <Button key="link-meeting" type="primary" icon={<ScheduleOutlined />}
          onClick={() => doTransition('LINK_TO_MEETING')}>
          ربط باجتماع
        </Button>,
      );
    }

    // ══════════════════════════════════════════════
    // LINKED_TO_MEETING → COUNCIL_SECRETARY: Withdraw / COUNCIL_PRESIDENT: Defer
    // ══════════════════════════════════════════════
    if (status === 'LINKED_TO_MEETING') {
      if (hasRole(userRoles, ['COUNCIL_SECRETARY'])) {
        actions.push(
          <Button key="withdraw" icon={<UndoOutlined />}
            onClick={() => doTransition('WITHDRAW_FROM_MEETING')}>
            سحب من الاجتماع
          </Button>,
        );
      }
      if (hasRole(userRoles, ['COUNCIL_PRESIDENT'])) {
        actions.push(
          <Button key="defer" icon={<PauseCircleOutlined />}
            onClick={() => doTransition('DEFER_IN_SESSION')}>
            تأجيل في الجلسة
          </Button>,
        );
      }
    }

    return actions.length > 0 ? <Space wrap>{actions}</Space> : null;
  };

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

      {renderActions() && (
        <Card style={{ marginBottom: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            الإجراءات المتاحة
          </Text>
          {renderActions()}
        </Card>
      )}

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

      <Modal
        title="إدخال السبب"
        open={reasonModal.visible}
        onOk={confirmReasonAction}
        onCancel={() => {
          setReasonModal({ action: '', visible: false });
          setReason('');
          setReturnType('');
        }}
        confirmLoading={transitionMutation.isPending}
        okText="تأكيد"
        cancelText="إلغاء"
      >
        <TextArea
          rows={4}
          placeholder="أدخل السبب"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={{ marginBottom: reasonModal.needsReturnType ? 16 : 0 }}
        />
        {reasonModal.needsReturnType && (
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>نوع الإعادة</Text>
            <Select
              style={{ width: '100%' }}
              placeholder="اختر نوع الإعادة"
              value={returnType || undefined}
              onChange={setReturnType}
              options={[
                { label: 'إعادة فحص كامل', value: 'FULL_REEXAM' },
                { label: 'تصحيح المسار', value: 'PATH_CORRECTION' },
              ]}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}

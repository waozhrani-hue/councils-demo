import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Select, Input, Space, Typography, Modal, message } from 'antd';
import { CheckOutlined, CloseOutlined, RollbackOutlined, PauseCircleOutlined, SearchOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';
import type { Topic, TopicStatus, PaginatedResponse } from '@/types';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Title } = Typography;
const { TextArea } = Input;

const gsStatuses: string[] = ['INBOX_GS', 'GS_REVIEW', 'SUSPENDED'];

export default function GSInboxPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [status, setStatus] = useState<TopicStatus | undefined>();
  const [search, setSearch] = useState('');
  const [reasonModal, setReasonModal] = useState<{ topicId: string; action: string; visible: boolean }>({
    topicId: '',
    action: '',
    visible: false,
  });
  const [reason, setReason] = useState('');

  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('limit', String(pageSize));
  queryParams.set('statuses', (status ? [status] : gsStatuses).join(','));
  if (search) queryParams.set('search', search);

  const { data, isLoading } = useQuery({
    queryKey: ['gs-inbox', page, pageSize, status, search],
    queryFn: () =>
      apiClient.get<PaginatedResponse<Topic>>(`/api/v1/topics?${queryParams.toString()}`),
  });

  const transitionMutation = useMutation({
    mutationFn: (data: { topicId: string; action: string; reason?: string }) =>
      apiClient.post(`/api/v1/topics/${data.topicId}/transition`, {
        action: data.action,
        reason: data.reason,
      }),
    onSuccess: () => {
      message.success('تم تحديث الحالة');
      queryClient.invalidateQueries({ queryKey: ['gs-inbox'] });
      setReasonModal({ topicId: '', action: '', visible: false });
      setReason('');
    },
    onError: (err: Error) => {
      message.error(err.message || 'فشل تحديث الحالة');
    },
  });

  const handleAction = (topicId: string, action: string) => {
    if (['REJECT', 'RETURN_WRONG_COUNCIL', 'SUSPEND'].includes(action)) {
      setReasonModal({ topicId, action, visible: true });
    } else {
      transitionMutation.mutate({ topicId, action });
    }
  };

  const confirmReasonAction = () => {
    if (!reason.trim()) {
      message.warning('يرجى إدخال السبب');
      return;
    }
    transitionMutation.mutate({
      topicId: reasonModal.topicId,
      action: reasonModal.action,
      reason,
    });
  };

  const columns: ColumnsType<Topic> = [
    {
      title: 'الرقم المرجعي',
      dataIndex: 'referenceNumber',
      key: 'referenceNumber',
      width: 140,
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
      title: 'الإدارة',
      dataIndex: ['requestingOrg', 'name'],
      key: 'orgUnit',
      width: 140,
    },
    {
      title: 'الحالة',
      dataIndex: 'status',
      key: 'status',
      width: 160,
      render: (s: TopicStatus) => <StatusBadge status={s} />,
    },
    {
      title: 'التاريخ',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 110,
      render: (date: string) => dayjs(date).format('YYYY/MM/DD'),
    },
    {
      title: 'الإجراءات',
      key: 'actions',
      width: 280,
      render: (_: unknown, record: Topic) => {
        const s = record.status;
        return (
          <Space size="small">
            {(s === 'INBOX_GS' || s === 'GS_REVIEW') && (
              <>
                <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => handleAction(record.id, 'ACCEPT')}>
                  قبول
                </Button>
                <Button size="small" icon={<PauseCircleOutlined />} onClick={() => handleAction(record.id, 'SUSPEND')}>
                  تعليق
                </Button>
                <Button size="small" icon={<RollbackOutlined />} onClick={() => handleAction(record.id, 'RETURN_WRONG_COUNCIL')}>
                  إعادة
                </Button>
                <Button size="small" danger icon={<CloseOutlined />} onClick={() => handleAction(record.id, 'REJECT')}>
                  رفض
                </Button>
              </>
            )}
            {s === 'SUSPENDED' && (
              <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => handleAction(record.id, 'RESUME')}>
                استئناف
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        الوارد العام
      </Title>

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
          options={gsStatuses.map((s) => ({ label: { INBOX_GS: 'وارد الأمانة', GS_REVIEW: 'قيد المراجعة', SUSPENDED: 'معلّق' }[s] || s, value: s }))}
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
          total: data?.meta?.total || data?.total || 0,
          showSizeChanger: true,
          showTotal: (total) => `الإجمالي: ${total}`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      <Modal
        title="إدخال السبب"
        open={reasonModal.visible}
        onOk={confirmReasonAction}
        onCancel={() => {
          setReasonModal({ topicId: '', action: '', visible: false });
          setReason('');
        }}
        confirmLoading={transitionMutation.isPending}
        okText="تأكيد"
        cancelText="إلغاء"
      >
        <TextArea rows={4} placeholder="أدخل السبب" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </div>
  );
}

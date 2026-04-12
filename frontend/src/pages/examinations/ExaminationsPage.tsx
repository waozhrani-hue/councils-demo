import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Space, Typography, Modal, Input, Select, message } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';
import type { Topic, PaginatedResponse } from '@/types';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Title } = Typography;
const { TextArea } = Input;

export default function ExaminationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [resultModal, setResultModal] = useState<{ topicId: string; visible: boolean }>({
    topicId: '',
    visible: false,
  });
  const [examResult, setExamResult] = useState<string>('EXAM_PASS');
  const [examReason, setExamReason] = useState('');

  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('pageSize', String(pageSize));
  queryParams.set('statuses', 'WITH_COUNCIL,EXAM_IN_PROGRESS,EXAM_INCOMPLETE,EXAM_COMPLETE');

  const { data, isLoading } = useQuery({
    queryKey: ['examinations', page, pageSize],
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
      message.success('تم تسجيل نتيجة الفحص');
      queryClient.invalidateQueries({ queryKey: ['examinations'] });
      setResultModal({ topicId: '', visible: false });
      setExamReason('');
    },
    onError: (err: Error) => {
      message.error(err.message || 'فشل تسجيل النتيجة');
    },
  });

  const handleRecordResult = (topicId: string) => {
    setResultModal({ topicId, visible: true });
  };

  const confirmResult = () => {
    if (examResult === 'EXAM_FAIL' && !examReason.trim()) {
      message.warning('يرجى إدخال سبب عدم الاكتمال');
      return;
    }
    transitionMutation.mutate({
      topicId: resultModal.topicId,
      action: examResult,
      reason: examReason || undefined,
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
      title: 'المجلس',
      dataIndex: ['council', 'name'],
      key: 'council',
      width: 140,
    },
    {
      title: 'الحالة',
      dataIndex: 'status',
      key: 'status',
      width: 160,
      render: (s: string) => <StatusBadge status={s} />,
    },
    {
      title: 'التاريخ',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 110,
      render: (date: string) => dayjs(date).format('YYYY/MM/DD'),
    },
    {
      title: 'الإجراء',
      key: 'actions',
      width: 160,
      render: (_: unknown, record: Topic) => (
        <Button type="primary" onClick={() => handleRecordResult(record.id)}>
          تسجيل النتيجة
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        الفحص
      </Title>

      <Table
        columns={columns}
        dataSource={data?.data || []}
        rowKey="id"
        loading={isLoading}
        pagination={{
          current: page,
          pageSize,
          total: data?.total || 0,
          showSizeChanger: true,
          showTotal: (total) => `الإجمالي: ${total}`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      <Modal
        title="تسجيل نتيجة الفحص"
        open={resultModal.visible}
        onOk={confirmResult}
        onCancel={() => {
          setResultModal({ topicId: '', visible: false });
          setExamReason('');
          setExamResult('EXAM_PASS');
        }}
        confirmLoading={transitionMutation.isPending}
        okText="تأكيد"
        cancelText="إلغاء"
      >
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8 }}>النتيجة</label>
          <Select
            style={{ width: '100%' }}
            value={examResult}
            onChange={setExamResult}
            options={[
              { label: 'فحص مكتمل', value: 'EXAM_PASS' },
              { label: 'فحص غير مكتمل', value: 'EXAM_FAIL' },
            ]}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 8 }}>الملاحظات</label>
          <TextArea rows={4} placeholder="أدخل الملاحظات" value={examReason} onChange={(e) => setExamReason(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}

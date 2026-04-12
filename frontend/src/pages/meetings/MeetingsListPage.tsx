import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Button,
  Typography,
  Space,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuthStore, getUserCouncilIds, isGlobalRole } from '@/lib/auth';
import StatusBadge from '@/components/StatusBadge';
import type { Meeting, MeetingStatus, Council, PaginatedResponse } from '@/types';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Title } = Typography;

export default function MeetingsListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();

  const userCouncilIds = getUserCouncilIds(user);
  const global = isGlobalRole(user);

  const { data: councils } = useQuery({
    queryKey: ['councils'],
    queryFn: () => apiClient.get<Council[]>('/api/v1/councils'),
  });

  // Filter councils shown in the create form to user's scoped councils
  const availableCouncils = global
    ? (Array.isArray(councils) ? councils : [])
    : (Array.isArray(councils) ? councils : []).filter((c) => userCouncilIds.includes(c.id));

  const { data, isLoading } = useQuery({
    queryKey: ['meetings', page, pageSize],
    queryFn: () =>
      apiClient.get<Meeting[]>('/api/v1/meetings'),
  });

  const createMutation = useMutation({
    mutationFn: (values: { title: string; councilId: string; scheduledAt: string; location?: string }) =>
      apiClient.post<Meeting>(`/api/v1/councils/${values.councilId}/meetings`, values),
    onSuccess: (meeting) => {
      message.success('تم إنشاء الاجتماع');
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      setCreateModalOpen(false);
      form.resetFields();
      navigate(`/meetings/${meeting.id}`);
    },
    onError: (err: Error) => {
      message.error(err.message || 'فشل إنشاء الاجتماع');
    },
  });

  const handleCreate = () => {
    form.validateFields().then((values) => {
      createMutation.mutate({
        ...values,
        scheduledAt: values.scheduledDate?.toISOString(),
      });
    });
  };

  const meetings = Array.isArray(data) ? data : (data as any)?.data || [];

  const columns: ColumnsType<Meeting> = [
    {
      title: 'رقم الاجتماع',
      dataIndex: 'meetingNumber',
      key: 'meetingNumber',
      width: 130,
    },
    {
      title: 'العنوان',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (text: string, record: Meeting) => (
        <a onClick={() => navigate(`/meetings/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: 'المجلس',
      dataIndex: ['council', 'name'],
      key: 'council',
      width: 140,
    },
    {
      title: 'التاريخ المجدول',
      dataIndex: 'scheduledDate',
      key: 'scheduledDate',
      width: 140,
      render: (date: string) => dayjs(date).format('YYYY/MM/DD HH:mm'),
    },
    {
      title: 'المكان',
      dataIndex: 'location',
      key: 'location',
      width: 140,
    },
    {
      title: 'الحالة',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (s: MeetingStatus) => <StatusBadge status={s} />,
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          الاجتماعات
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
          إنشاء اجتماع
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={meetings}
        rowKey="id"
        loading={isLoading}
        pagination={{
          current: page,
          pageSize,
          total: meetings.length,
          showSizeChanger: true,
          showTotal: (total) => `الإجمالي: ${total}`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      <Modal
        title="إنشاء اجتماع جديد"
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => {
          setCreateModalOpen(false);
          form.resetFields();
        }}
        confirmLoading={createMutation.isPending}
        okText="إنشاء"
        cancelText="إلغاء"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="عنوان الاجتماع" rules={[{ required: true, message: 'مطلوب' }]}>
            <Input placeholder="أدخل عنوان الاجتماع" />
          </Form.Item>
          <Form.Item name="councilId" label="المجلس" rules={[{ required: true, message: 'مطلوب' }]}>
            <Select
              placeholder="اختر المجلس"
              options={availableCouncils.map((c) => ({
                label: c.name,
                value: c.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="scheduledDate" label="التاريخ والوقت" rules={[{ required: true, message: 'مطلوب' }]}>
            <DatePicker showTime style={{ width: '100%' }} placeholder="اختر التاريخ والوقت" />
          </Form.Item>
          <Form.Item name="location" label="المكان">
            <Input placeholder="أدخل مكان الاجتماع" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

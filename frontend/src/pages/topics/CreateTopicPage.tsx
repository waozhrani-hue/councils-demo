import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Select, Upload, Button, Card, Space, message, Typography } from 'antd';
import { UploadOutlined, SaveOutlined, SendOutlined, InboxOutlined } from '@ant-design/icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { Council, SecretLevel, Topic } from '@/types';

const { Title } = Typography;
const { TextArea } = Input;
const { Dragger } = Upload;

export default function CreateTopicPage() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState<any[]>([]);

  const { data: councils } = useQuery({
    queryKey: ['councils'],
    queryFn: () => apiClient.get<Council[]>('/api/v1/councils'),
  });

  const { data: secretLevels } = useQuery({
    queryKey: ['secret-levels'],
    queryFn: () => apiClient.get<SecretLevel[]>('/api/v1/secret-levels'),
  });

  const createMutation = useMutation({
    mutationFn: (data: { title: string; body?: string; councilId: string; secrecyLevelId?: string; submit: boolean }) =>
      apiClient.post<Topic>('/api/v1/topics', data),
    onSuccess: async (topic, variables) => {
      if (fileList.length > 0) {
        const formData = new FormData();
        fileList.forEach((file) => {
          formData.append('files', file.originFileObj);
        });
        try {
          await apiClient.upload(`/api/v1/topics/${topic.id}/attachments`, formData);
        } catch {
          message.warning('تم إنشاء الموضوع لكن فشل رفع بعض المرفقات');
        }
      }
      message.success(variables.submit ? 'تم إرسال الموضوع للاعتماد' : 'تم حفظ المسودة');
      navigate(`/topics/${topic.id}`);
    },
    onError: (err: Error) => {
      message.error(err.message || 'فشل إنشاء الموضوع');
    },
  });

  const handleSubmit = (submit: boolean) => {
    form.validateFields().then((values) => {
      createMutation.mutate({ ...values, submit });
    });
  };

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        إنشاء موضوع جديد
      </Title>

      <Card>
        <Form form={form} layout="vertical" style={{ maxWidth: 800 }}>
          <Form.Item
            name="title"
            label="عنوان الموضوع"
            rules={[{ required: true, message: 'يرجى إدخال عنوان الموضوع' }]}
          >
            <Input placeholder="أدخل عنوان الموضوع" />
          </Form.Item>

          <Form.Item name="body" label="تفاصيل الموضوع">
            <TextArea rows={6} placeholder="أدخل تفاصيل الموضوع" />
          </Form.Item>

          <Form.Item
            name="councilId"
            label="المجلس"
            rules={[{ required: true, message: 'يرجى اختيار المجلس' }]}
          >
            <Select
              placeholder="اختر المجلس"
              options={(Array.isArray(councils) ? councils : []).map((c) => ({
                label: c.name,
                value: c.id,
              }))}
            />
          </Form.Item>

          <Form.Item name="secrecyLevelId" label="مستوى السرية">
            <Select
              placeholder="اختر مستوى السرية"
              allowClear
              options={(Array.isArray(secretLevels) ? secretLevels : []).map((s) => ({
                label: s.name,
                value: s.id,
              }))}
            />
          </Form.Item>

          <Form.Item label="المرفقات">
            <Dragger
              multiple
              fileList={fileList}
              onChange={({ fileList: newList }) => setFileList(newList)}
              beforeUpload={() => false}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">اضغط أو اسحب الملفات هنا لرفعها</p>
              <p className="ant-upload-hint">يمكنك رفع عدة ملفات في نفس الوقت</p>
            </Dragger>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                icon={<SaveOutlined />}
                loading={createMutation.isPending}
                onClick={() => handleSubmit(false)}
              >
                حفظ كمسودة
              </Button>
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={createMutation.isPending}
                onClick={() => handleSubmit(true)}
              >
                إرسال للاعتماد
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}

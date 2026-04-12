import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  Button,
  Typography,
  message,
  Space,
  Divider,
  Row,
  Col,
  Tag,
} from 'antd';
import {
  UserOutlined,
  LockOutlined,
  BankOutlined,
  LoginOutlined,
  CrownOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  SolutionOutlined,
  AuditOutlined,
  SettingOutlined,
  IdcardOutlined,
  FileSearchOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/lib/auth';

const { Title, Text } = Typography;

interface QuickUser {
  label: string;
  email: string;
  color: string;
  icon: React.ReactNode;
  description: string;
}

const quickUsers: QuickUser[] = [
  {
    label: 'مدير النظام',
    email: 'admin@company.sa',
    color: '#f5222d',
    icon: <SettingOutlined />,
    description: 'أحمد المدير',
  },
  {
    label: 'الأمين العام',
    email: 'gs@company.sa',
    color: '#722ed1',
    icon: <CrownOutlined />,
    description: 'د. خالد الأمين',
  },
  {
    label: 'موظف مكتب الأمين',
    email: 'gs.staff@company.sa',
    color: '#9254de',
    icon: <SafetyCertificateOutlined />,
    description: 'نورة العتيبي',
  },
  {
    label: 'أمين المجلس',
    email: 'tech.sec@company.sa',
    color: '#1677ff',
    icon: <AuditOutlined />,
    description: 'فهد السالم — مجلس التقنية',
  },
  {
    label: 'رئيس المجلس',
    email: 'tech.pres@company.sa',
    color: '#faad14',
    icon: <IdcardOutlined />,
    description: 'د. عمر الرئيس — مجلس التقنية',
  },
  {
    label: 'عضو مجلس',
    email: 'tech.m1@company.sa',
    color: '#13c2c2',
    icon: <TeamOutlined />,
    description: 'ماجد العضو — مجلس التقنية',
  },
  {
    label: 'مسؤول الفحص',
    email: 'tech.exam@company.sa',
    color: '#eb2f96',
    icon: <FileSearchOutlined />,
    description: 'خالد الفاحص — مجلس التقنية',
  },
  {
    label: 'مدير الإدارة',
    email: 'it.manager@company.sa',
    color: '#52c41a',
    icon: <SolutionOutlined />,
    description: 'سعود المدير — تقنية المعلومات',
  },
  {
    label: 'موظف الإدارة',
    email: 'it.staff@company.sa',
    color: '#1890ff',
    icon: <FileSearchOutlined />,
    description: 'محمد التقني — تقنية المعلومات',
  },
];

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [activeQuick, setActiveQuick] = useState<string | null>(null);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const doLogin = async (email: string, password: string) => {
    setLoading(true);
    try {
      await login(email, password);
      message.success('تم تسجيل الدخول بنجاح');
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'فشل تسجيل الدخول';
      message.error(errorMessage);
    } finally {
      setLoading(false);
      setActiveQuick(null);
    }
  };

  const onFinish = async (values: { email: string; password: string }) => {
    await doLogin(values.email, values.password);
  };

  const onQuickLogin = async (user: QuickUser) => {
    setActiveQuick(user.email);
    form.setFieldsValue({ email: user.email, password: 'Admin@123' });
    await doLogin(user.email, 'Admin@123');
  };

  return (
    <div className="login-container">
      <div className="login-wrapper">
        <Card className="login-card" bordered={false}>
          <div className="login-logo">
            <Space direction="vertical" align="center" size={4}>
              <BankOutlined style={{ fontSize: 48, color: '#1677ff' }} />
              <Title level={3} style={{ margin: 0, color: '#1677ff' }}>
                نظام إدارة المجالس
              </Title>
              <Text type="secondary">تسجيل الدخول إلى النظام</Text>
            </Space>
          </div>
          <Form
            form={form}
            name="login"
            onFinish={onFinish}
            layout="vertical"
            size="large"
            autoComplete="off"
          >
            <Form.Item
              name="email"
              label="البريد الإلكتروني"
              rules={[
                { required: true, message: 'يرجى إدخال البريد الإلكتروني' },
                { type: 'email', message: 'البريد الإلكتروني غير صالح' },
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="البريد الإلكتروني"
              />
            </Form.Item>
            <Form.Item
              name="password"
              label="كلمة المرور"
              rules={[
                { required: true, message: 'يرجى إدخال كلمة المرور' },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="كلمة المرور"
              />
            </Form.Item>
            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading && !activeQuick}
                block
                icon={<LoginOutlined />}
              >
                تسجيل الدخول
              </Button>
            </Form.Item>
          </Form>
        </Card>

        <Card
          className="quick-login-card"
          bordered={false}
          title={
            <Space>
              <TeamOutlined />
              <span>تسجيل دخول سريع (بيئة التطوير)</span>
            </Space>
          }
        >
          <Row gutter={[10, 10]}>
            {quickUsers.map((user) => (
              <Col xs={24} sm={12} key={user.email}>
                <Button
                  block
                  size="large"
                  loading={activeQuick === user.email}
                  disabled={loading && activeQuick !== user.email}
                  onClick={() => onQuickLogin(user)}
                  className="quick-login-btn"
                  style={{
                    borderColor: user.color,
                    height: 'auto',
                    padding: '10px 14px',
                    textAlign: 'right',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: user.color,
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 16,
                        flexShrink: 0,
                      }}
                    >
                      {user.icon}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontWeight: 600, fontSize: 13, lineHeight: '20px' }}>
                        <Tag color={user.color} style={{ marginLeft: 0, marginBottom: 2 }}>
                          {user.label}
                        </Tag>
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: '#888',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {user.description}
                      </div>
                    </div>
                  </div>
                </Button>
              </Col>
            ))}
          </Row>
          <Divider style={{ margin: '12px 0 8px' }} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            كلمة المرور لجميع الحسابات: <Text code>Admin@123</Text>
          </Text>
        </Card>
      </div>
    </div>
  );
}

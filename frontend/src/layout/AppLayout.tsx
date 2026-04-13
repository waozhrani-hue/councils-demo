import { useState, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Layout,
  Menu,
  Dropdown,
  Badge,
  Button,
  Typography,
  Breadcrumb,
  theme,
} from 'antd';
import {
  DashboardOutlined,
  FileTextOutlined,
  InboxOutlined,
  SearchOutlined,
  CalendarOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  BellOutlined,
  SwapOutlined,
  SettingOutlined,
  UserOutlined,
  BankOutlined,
  ApartmentOutlined,
  ToolOutlined,
  AuditOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useAuthStore } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { RoleName, UserRoleBrief } from '@/types';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const breadcrumbLabels: Record<string, string> = {
  dashboard: 'لوحة المعلومات',
  topics: 'المواضيع',
  new: 'إنشاء جديد',
  inbox: 'الوارد العام',
  examinations: 'الفحص',
  agenda: 'صندوق الأجندة',
  meetings: 'الاجتماعات',
  minutes: 'المحاضر',
  decisions: 'القرارات',
  notifications: 'الإشعارات',
  delegations: 'التفويضات',
  team: 'إدارة الفريق',
  admin: 'الإدارة',
  users: 'المستخدمون',
  councils: 'المجالس',
  'org-units': 'الوحدات التنظيمية',
  config: 'التهيئة',
  audit: 'التدقيق',
};

function hasRole(roles: UserRoleBrief[] | undefined, codes: RoleName[]): boolean {
  if (!roles) return false;
  return roles.some((r) => codes.includes(r.code));
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const { data: notificationsData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => apiClient.get<{ count: number }>('/api/v1/notifications/unread-count'),
    refetchInterval: 30000,
  });

  const unreadCount = notificationsData?.count ?? 0;
  const userRoles = user?.roles;

  const menuItems = useMemo(() => {
    const items: MenuProps['items'] = [];

    // ── لوحة المعلومات — للجميع ──
    items.push({
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'لوحة المعلومات',
    });

    // ══════════════════════════════════════════
    // أدوار الإدارة: DEPT_STAFF, DEPT_MANAGER
    // ══════════════════════════════════════════

    // ── المواضيع — موظف/مدير إدارة (مواضيع إدارتهم) ──
    if (hasRole(userRoles, ['DEPT_STAFF', 'DEPT_MANAGER'])) {
      items.push({
        key: '/topics',
        icon: <FileTextOutlined />,
        label: 'مواضيع الإدارة',
      });
    }

    // ══════════════════════════════════════════
    // أدوار الأمانة: GENERAL_SECRETARY, GS_OFFICE_STAFF
    // ══════════════════════════════════════════

    // ── الوارد العام — فقط الأمين العام وموظف مكتبه ──
    if (hasRole(userRoles, ['GENERAL_SECRETARY', 'GS_OFFICE_STAFF'])) {
      items.push({
        key: '/inbox',
        icon: <InboxOutlined />,
        label: 'الوارد العام',
      });
    }

    // ── جميع المواضيع — الأمين العام فقط (إشراف عام) ──
    if (hasRole(userRoles, ['GENERAL_SECRETARY', 'GS_OFFICE_STAFF'])) {
      items.push({
        key: '/topics',
        icon: <FileTextOutlined />,
        label: 'جميع المواضيع',
      });
    }

    // ══════════════════════════════════════════
    // أدوار المجلس: COUNCIL_SECRETARY, COUNCIL_PRESIDENT, COUNCIL_MEMBER, COUNCIL_STAFF, EXAM_OFFICER
    // ══════════════════════════════════════════

    // ── الفحص — موظف فحص + أمين المجلس ──
    if (hasRole(userRoles, ['EXAM_OFFICER', 'COUNCIL_SECRETARY'])) {
      items.push({
        key: '/examinations',
        icon: <SearchOutlined />,
        label: 'الفحص',
      });
    }

    // ── صندوق الأجندة — أمين المجلس فقط (إدارة الأجندة) ──
    if (hasRole(userRoles, ['COUNCIL_SECRETARY'])) {
      items.push({
        key: '/agenda',
        icon: <CalendarOutlined />,
        label: 'صندوق الأجندة',
      });
    }

    // ── الاجتماعات — أمين المجلس + رئيس المجلس + عضو مجلس + موظف مجلس ──
    if (hasRole(userRoles, ['COUNCIL_SECRETARY', 'COUNCIL_PRESIDENT', 'COUNCIL_MEMBER', 'COUNCIL_STAFF'])) {
      items.push({
        key: '/meetings',
        icon: <TeamOutlined />,
        label: 'الاجتماعات',
      });
    }

    // ── المحاضر — أمين المجلس + رئيس المجلس + عضو مجلس ──
    if (hasRole(userRoles, ['COUNCIL_SECRETARY', 'COUNCIL_PRESIDENT', 'COUNCIL_MEMBER', 'GENERAL_SECRETARY'])) {
      items.push({
        key: '/minutes',
        icon: <AuditOutlined />,
        label: 'المحاضر',
      });
    }

    // ── القرارات — للجميع ──
    items.push({
      key: '/decisions',
      icon: <CheckCircleOutlined />,
      label: 'القرارات',
    });

    // ── الإشعارات — للجميع ──
    items.push({
      key: '/notifications',
      icon: <BellOutlined />,
      label: 'الإشعارات',
    });

    // ── إدارة الفريق — أمين المجلس + مدير الإدارة + الأمين العام ──
    if (hasRole(userRoles, ['COUNCIL_SECRETARY', 'DEPT_MANAGER', 'GENERAL_SECRETARY'])) {
      items.push({
        key: '/team',
        icon: <UserOutlined />,
        label: 'إدارة الفريق',
      });
    }

    // ── التفويضات — الأدوار التي تمتلك صلاحيات قابلة للتفويض ──
    if (hasRole(userRoles, ['DEPT_MANAGER', 'GENERAL_SECRETARY', 'GS_OFFICE_STAFF', 'COUNCIL_SECRETARY', 'COUNCIL_PRESIDENT'])) {
      items.push({
        key: '/delegations',
        icon: <SwapOutlined />,
        label: 'التفويضات',
      });
    }

    // ── الإدارة — مدير النظام ──
    if (hasRole(userRoles, ['SYSTEM_ADMIN'])) {
      items.push({
        key: '/admin',
        icon: <SettingOutlined />,
        label: 'الإدارة',
        children: [
          { key: '/admin/users', icon: <UserOutlined />, label: 'المستخدمون' },
          { key: '/admin/councils', icon: <BankOutlined />, label: 'المجالس' },
          { key: '/admin/org-units', icon: <ApartmentOutlined />, label: 'الوحدات' },
          { key: '/admin/config', icon: <ToolOutlined />, label: 'التهيئة' },
          { key: '/admin/audit', icon: <AuditOutlined />, label: 'التدقيق' },
        ],
      });
    }

    return items;
  }, [userRoles]);

  const pathSegments = location.pathname.split('/').filter(Boolean);
  const breadcrumbItems = [
    { title: 'الرئيسية', href: '/' },
    ...pathSegments.map((seg, idx) => ({
      title: breadcrumbLabels[seg] || seg,
      href: '/' + pathSegments.slice(0, idx + 1).join('/'),
    })),
  ];

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'تسجيل الخروج',
      onClick: logout,
    },
  ];

  const selectedKeys = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith('/admin/')) return [path];
    if (path.startsWith('/topics')) return ['/topics'];
    if (path.startsWith('/meetings')) return ['/meetings'];
    if (path.startsWith('/minutes')) return ['/minutes'];
    if (path.startsWith('/agenda')) return ['/agenda'];
    return [path];
  }, [location.pathname]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        style={{ overflow: 'auto', height: '100vh', position: 'fixed', right: 0, top: 0, bottom: 0 }}
        theme="dark"
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 'bold',
            fontSize: collapsed ? 14 : 16,
            padding: '0 8px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          {collapsed ? 'المجالس' : 'نظام إدارة المجالس'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKeys}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout style={{ marginRight: collapsed ? 80 : 200, transition: 'margin 0.2s' }}>
        <Header
          style={{
            padding: '0 24px',
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
            />
            <Title level={5} style={{ margin: 0 }}>
              نظام إدارة المجالس
            </Title>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Badge count={unreadCount} size="small">
              <Button
                type="text"
                icon={<BellOutlined />}
                onClick={() => navigate('/notifications')}
              />
            </Badge>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomLeft">
              <Button type="text" icon={<UserOutlined />}>
                {user?.displayName || user?.email}
              </Button>
            </Dropdown>
          </div>
        </Header>
        <Content style={{ margin: 24 }}>
          <Breadcrumb style={{ marginBottom: 16 }} items={breadcrumbItems} />
          <div
            style={{
              padding: 24,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
              minHeight: 360,
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}

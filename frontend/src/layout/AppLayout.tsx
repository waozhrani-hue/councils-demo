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
  Spin,
} from 'antd';
import * as Icons from '@ant-design/icons';
import {
  BellOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useAuthStore } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useMenuItems } from '@/hooks/usePermissions';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const breadcrumbLabels: Record<string, string> = {
  dashboard: 'لوحة المعلومات',
  topics: 'المواضيع',
  'all-topics': 'جميع المواضيع',
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
  'org-structure': 'الهيكل التنظيمي',
  roles: 'الأدوار والصلاحيات',
  'org-units': 'الوحدات التنظيمية',
  config: 'التهيئة',
  audit: 'التدقيق',
};

// Map icon name string to React element
function getIcon(iconName: string): React.ReactNode {
  const IconComponent = (Icons as any)[iconName];
  return IconComponent ? <IconComponent /> : null;
}

// Convert dynamic menu items from API to Ant Design MenuProps items
function toAntMenuItems(items: any[]): MenuProps['items'] {
  return items.map((item) => {
    const menuItem: any = {
      key: item.key,
      icon: getIcon(item.icon),
      label: item.nameAr,
    };
    if (item.children && item.children.length > 0) {
      menuItem.children = toAntMenuItems(item.children);
    }
    return menuItem;
  });
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
  const { menuItems, isLoading: menuLoading } = useMenuItems();

  const antMenuItems = useMemo(() => toAntMenuItems(menuItems), [menuItems]);

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
    if (path.startsWith('/all-topics')) return ['/all-topics'];
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
        {menuLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
        ) : (
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={selectedKeys}
            items={antMenuItems}
            onClick={({ key }) => navigate(key)}
          />
        )}
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

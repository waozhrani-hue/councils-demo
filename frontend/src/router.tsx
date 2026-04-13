import { createBrowserRouter } from 'react-router-dom';
import AppLayout from '@/layout/AppLayout';
import ProtectedRoute from '@/layout/ProtectedRoute';
import LoginPage from '@/pages/login/LoginPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import TopicsListPage from '@/pages/topics/TopicsListPage';
import AllTopicsPage from '@/pages/topics/AllTopicsPage';
import CreateTopicPage from '@/pages/topics/CreateTopicPage';
import TopicDetailPage from '@/pages/topics/TopicDetailPage';
import GSInboxPage from '@/pages/inbox/GSInboxPage';
import ExaminationsPage from '@/pages/examinations/ExaminationsPage';
import AgendaBoxPage from '@/pages/agenda/AgendaBoxPage';
import MeetingsListPage from '@/pages/meetings/MeetingsListPage';
import MeetingDetailPage from '@/pages/meetings/MeetingDetailPage';
import MinutesListPage from '@/pages/minutes/MinutesListPage';
import MinutesDetailPage from '@/pages/minutes/MinutesDetailPage';
import DecisionsListPage from '@/pages/decisions/DecisionsListPage';
import NotificationsPage from '@/pages/notifications/NotificationsPage';
import DelegationsPage from '@/pages/delegations/DelegationsPage';
import TeamPage from '@/pages/team/TeamPage';
import AdminUsersPage from '@/pages/admin/AdminUsersPage';
import AdminCouncilsPage from '@/pages/admin/AdminCouncilsPage';
import AdminOrgUnitsPage from '@/pages/admin/AdminOrgUnitsPage';
import AdminOrgStructurePage from '@/pages/admin/AdminOrgStructurePage';
import AdminRolesPage from '@/pages/admin/AdminRolesPage';
import AdminConfigPage from '@/pages/admin/AdminConfigPage';
import AdminAuditPage from '@/pages/admin/AdminAuditPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'topics', element: <TopicsListPage /> },
          { path: 'topics/new', element: <CreateTopicPage /> },
          { path: 'topics/:id', element: <TopicDetailPage /> },
          { path: 'all-topics', element: <AllTopicsPage /> },
          { path: 'inbox', element: <GSInboxPage /> },
          { path: 'examinations', element: <ExaminationsPage /> },
          { path: 'agenda/:councilId?', element: <AgendaBoxPage /> },
          { path: 'agenda', element: <AgendaBoxPage /> },
          { path: 'meetings', element: <MeetingsListPage /> },
          { path: 'meetings/:id', element: <MeetingDetailPage /> },
          { path: 'minutes', element: <MinutesListPage /> },
          { path: 'minutes/:id', element: <MinutesDetailPage /> },
          { path: 'decisions', element: <DecisionsListPage /> },
          { path: 'notifications', element: <NotificationsPage /> },
          { path: 'delegations', element: <DelegationsPage /> },
          { path: 'team', element: <TeamPage /> },
          { path: 'admin/users', element: <AdminUsersPage /> },
          { path: 'admin/councils', element: <AdminCouncilsPage /> },
          { path: 'admin/org-units', element: <AdminOrgUnitsPage /> },
          { path: 'admin/org-structure', element: <AdminOrgStructurePage /> },
          { path: 'admin/roles', element: <AdminRolesPage /> },
          { path: 'admin/config', element: <AdminConfigPage /> },
          { path: 'admin/audit', element: <AdminAuditPage /> },
        ],
      },
    ],
  },
]);

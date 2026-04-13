import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';

interface MenuItem {
  key: string;
  nameAr: string;
  icon: string;
  permission: string | null;
  children?: MenuItem[];
}

interface PermissionsData {
  permissions: string[];
  roles: Array<{
    code: string;
    nameAr: string;
    councilId: string | null;
    councilName: string | null;
    scope: string;
  }>;
}

export function usePermissions() {
  const user = useAuthStore((s) => s.user);

  const { data, isLoading } = useQuery({
    queryKey: ['my-permissions', user?.id],
    queryFn: () => apiClient.get<PermissionsData>('/api/v1/workflow/my-permissions'),
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 min cache
  });

  const permissions = data?.permissions || [];
  const roles = data?.roles || [];

  const hasPermission = (code: string) => permissions.includes(code);
  const hasAnyPermission = (...codes: string[]) => codes.some((c) => permissions.includes(c));

  return { permissions, roles, hasPermission, hasAnyPermission, isLoading };
}

export function useMenuItems() {
  const user = useAuthStore((s) => s.user);

  const { data, isLoading } = useQuery({
    queryKey: ['menu-items', user?.id],
    queryFn: () => apiClient.get<MenuItem[]>('/api/v1/workflow/menu'),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  return { menuItems: data || [], isLoading };
}

export interface AvailableAction {
  actionCode: string;
  actionNameAr: string;
  actionNameEn: string;
  requiresReason: boolean;
  requiresComment: boolean;
  isHierarchical: boolean;
  buttonColor: string;
  buttonIcon: string | null;
  toStateCode: string;
  toStateNameAr: string;
}

export function useAvailableActions(entityType: string, entityId: string | undefined) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['available-actions', entityType, entityId],
    queryFn: () =>
      apiClient.get<AvailableAction[]>(`/api/v1/workflow/available-actions/${entityType}/${entityId}`),
    enabled: !!entityId,
  });

  return { actions: data || [], isLoading, refetch };
}

export interface WorkflowStateInfo {
  code: string;
  nameAr: string;
  nameEn: string;
  color: string;
  stateType: string;
}

export function useWorkflowStates(workflowCode: string) {
  const { data } = useQuery({
    queryKey: ['workflow-states', workflowCode],
    queryFn: () => apiClient.get<WorkflowStateInfo[]>(`/api/v1/workflow/states/${workflowCode}`),
    staleTime: 30 * 60 * 1000, // 30 min cache — rarely changes
  });

  return data || [];
}

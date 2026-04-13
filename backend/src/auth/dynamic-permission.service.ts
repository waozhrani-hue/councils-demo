import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DynamicPermissionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all permission codes for a user (from roles + active delegations)
   */
  async getUserPermissions(userId: string, councilId?: string): Promise<string[]> {
    // 1. Get permissions from user's roles
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    const permissionSet = new Set<string>();

    for (const ur of userRoles) {
      // For council-scoped roles, only include if councilId matches or no councilId filter
      if (ur.role.scope === 'COUNCIL' && councilId && ur.councilId !== councilId) {
        continue;
      }
      for (const rp of ur.role.permissions) {
        if (rp.permission.isActive) {
          permissionSet.add(rp.permission.code);
        }
      }
    }

    // 2. Get permissions from active delegations
    const now = new Date();
    const delegations = await this.prisma.delegation.findMany({
      where: {
        toUserId: userId,
        state: 'DELEGATION_ACTIVE',
        validFrom: { lte: now },
        validUntil: { gte: now },
      },
    });

    for (const d of delegations) {
      try {
        const scope = JSON.parse(d.scopeJson);
        if (d.scopeType === 'FULL_ROLE' && scope.roleCode) {
          // Get all permissions for the delegated role
          const role = await this.prisma.role.findUnique({
            where: { code: scope.roleCode },
            include: { permissions: { include: { permission: true } } },
          });
          if (role) {
            for (const rp of role.permissions) {
              if (rp.permission.isActive) {
                permissionSet.add(rp.permission.code);
              }
            }
          }
        } else if (d.scopeType === 'SPECIFIC_PERMISSION' && scope.permissionCodes) {
          for (const code of scope.permissionCodes) {
            permissionSet.add(code);
          }
        }
      } catch {
        // Invalid JSON in scopeJson, skip
      }
    }

    return Array.from(permissionSet);
  }

  /**
   * Check if a user has a specific permission
   */
  async hasPermission(userId: string, permissionCode: string, councilId?: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId, councilId);
    return permissions.includes(permissionCode);
  }

  /**
   * Get user's roles with their codes
   */
  async getUserRoles(userId: string) {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true, council: true },
    });
    return userRoles.map((ur) => ({
      code: ur.role.code,
      nameAr: ur.role.nameAr,
      councilId: ur.councilId,
      councilName: ur.council?.name,
      scope: ur.role.scope,
    }));
  }

  /**
   * Get menu items the user can access based on permissions
   */
  async getUserMenuItems(userId: string) {
    const permissions = await this.getUserPermissions(userId);

    // Define menu → permission mapping
    const menuConfig = [
      { key: '/dashboard', nameAr: 'لوحة المعلومات', icon: 'DashboardOutlined', permission: null }, // Everyone
      { key: '/topics', nameAr: 'المواضيع', icon: 'FileTextOutlined', permission: 'VIEW_TOPICS' },
      { key: '/all-topics', nameAr: 'جميع المواضيع', icon: 'FileTextOutlined', permission: 'VIEW_ALL_TOPICS' },
      { key: '/inbox', nameAr: 'الوارد العام', icon: 'InboxOutlined', permission: 'ACCEPT_GS' },
      { key: '/examinations', nameAr: 'الفحص', icon: 'SearchOutlined', permission: 'PERFORM_EXAM' },
      { key: '/agenda', nameAr: 'صندوق الأجندة', icon: 'CalendarOutlined', permission: 'MANAGE_AGENDA' },
      { key: '/meetings', nameAr: 'الاجتماعات', icon: 'TeamOutlined', permission: 'VIEW_MEETINGS' },
      { key: '/minutes', nameAr: 'المحاضر', icon: 'AuditOutlined', permission: 'VIEW_MINUTES' },
      { key: '/decisions', nameAr: 'القرارات', icon: 'CheckCircleOutlined', permission: 'VIEW_DECISIONS' },
      { key: '/notifications', nameAr: 'الإشعارات', icon: 'BellOutlined', permission: 'VIEW_NOTIFICATIONS' },
      { key: '/delegations', nameAr: 'التفويضات', icon: 'SwapOutlined', permission: 'CREATE_DELEGATION' },
      { key: '/team', nameAr: 'إدارة الفريق', icon: 'UserOutlined', permission: 'MANAGE_TEAM' },
      {
        key: '/admin', nameAr: 'الإدارة', icon: 'SettingOutlined', permission: 'MANAGE_USERS',
        children: [
          { key: '/admin/users', nameAr: 'المستخدمون', icon: 'UserOutlined', permission: 'MANAGE_USERS' },
          { key: '/admin/councils', nameAr: 'المجالس', icon: 'BankOutlined', permission: 'MANAGE_COUNCILS' },
          { key: '/admin/org-structure', nameAr: 'الهيكل التنظيمي', icon: 'ApartmentOutlined', permission: 'MANAGE_ORG_STRUCTURE' },
          { key: '/admin/roles', nameAr: 'الأدوار والصلاحيات', icon: 'SafetyOutlined', permission: 'MANAGE_ROLES' },
          { key: '/admin/config', nameAr: 'التهيئة', icon: 'ToolOutlined', permission: 'MANAGE_CONFIG' },
          { key: '/admin/audit', nameAr: 'التدقيق', icon: 'AuditOutlined', permission: 'VIEW_AUDIT' },
        ],
      },
    ];

    const filterMenu = (items: any[]): any[] => {
      return items
        .filter((item) => {
          if (!item.permission) return true; // No permission required
          return permissions.includes(item.permission);
        })
        .map((item) => {
          if (item.children) {
            const filteredChildren = filterMenu(item.children);
            if (filteredChildren.length === 0) return null;
            return { ...item, children: filteredChildren };
          }
          return item;
        })
        .filter(Boolean);
    };

    return filterMenu(menuConfig);
  }
}

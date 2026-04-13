import { useState } from 'react';
import { Table, Card, Tag, Typography, Collapse, List } from 'antd';
import { SafetyOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

const { Title, Text } = Typography;

interface Permission {
  id: string;
  code: string;
  nameAr: string;
  module: string;
  isActive: boolean;
}

interface Role {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  description: string | null;
  scope: string;
  isSystem: boolean;
  permissions: Array<{ permission: Permission }>;
}

export default function AdminRolesPage() {
  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => apiClient.get<Role[]>('/api/v1/workflow/definitions').then(() => []),
  });

  // For now, fetch roles from a dedicated endpoint or derive from permissions
  const { data: permissionsData } = useQuery({
    queryKey: ['all-permissions'],
    queryFn: async () => {
      // Use the workflow definitions endpoint to at least show workflow info
      const defs = await apiClient.get<any[]>('/api/v1/workflow/definitions');
      return defs;
    },
  });

  const { data: myPerms } = useQuery({
    queryKey: ['my-permissions-admin'],
    queryFn: () => apiClient.get<{ permissions: string[]; roles: Array<{ code: string; nameAr: string; scope: string }> }>('/api/v1/workflow/my-permissions'),
  });

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        <SafetyOutlined /> الأدوار والصلاحيات
      </Title>

      {myPerms && (
        <Card title="أدواري الحالية" style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>
            {myPerms.roles?.map((r) => (
              <Tag key={r.code} color="blue">{r.nameAr} ({r.code})</Tag>
            ))}
          </div>
          <Text type="secondary">عدد الصلاحيات: {myPerms.permissions?.length || 0}</Text>
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {myPerms.permissions?.map((p) => (
              <Tag key={p} color="green" style={{ fontSize: 11 }}>{p}</Tag>
            ))}
          </div>
        </Card>
      )}

      {permissionsData && (
        <Card title="تعريفات سير العمل">
          <Collapse>
            {(Array.isArray(permissionsData) ? permissionsData : []).map((def: any) => (
              <Collapse.Panel key={def.id} header={`${def.nameAr} (${def.entityType})`}>
                <Title level={5}>الحالات</Title>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 16 }}>
                  {def.states?.map((s: any) => (
                    <Tag key={s.id} color={s.color}>{s.nameAr} ({s.code})</Tag>
                  ))}
                </div>
                <Title level={5}>الانتقالات</Title>
                <List
                  size="small"
                  dataSource={def.transitions || []}
                  renderItem={(t: any) => (
                    <List.Item>
                      <Text>{t.actionNameAr}</Text>
                      <Text type="secondary" style={{ marginRight: 8, marginLeft: 8 }}>
                        {t.fromState?.nameAr} → {t.toState?.nameAr}
                      </Text>
                      <Tag>{t.permissionCode}</Tag>
                    </List.Item>
                  )}
                />
              </Collapse.Panel>
            ))}
          </Collapse>
        </Card>
      )}
    </div>
  );
}

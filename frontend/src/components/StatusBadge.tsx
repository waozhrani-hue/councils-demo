import { Tag } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

interface WorkflowStateInfo {
  code: string;
  nameAr: string;
  color: string;
}

// Fetch all workflow states and build maps
function useAllWorkflowStates() {
  const workflows = ['topic', 'meeting', 'minutes'];

  const results = workflows.map((wf) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useQuery({
      queryKey: ['workflow-states', wf],
      queryFn: () => apiClient.get<WorkflowStateInfo[]>(`/api/v1/workflow/states/${wf}`),
      staleTime: 30 * 60 * 1000,
    }),
  );

  const colorMap: Record<string, string> = {};
  const labelMap: Record<string, string> = {};

  for (const r of results) {
    if (r.data) {
      for (const s of r.data) {
        colorMap[s.code] = s.color;
        labelMap[s.code] = s.nameAr;
      }
    }
  }

  return { colorMap, labelMap };
}

// Export for reuse in dropdowns
export function useStatusLabels() {
  const { labelMap } = useAllWorkflowStates();
  return labelMap;
}

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const { colorMap, labelMap } = useAllWorkflowStates();
  const color = colorMap[status] || 'default';
  const label = labelMap[status] || status;

  return <Tag color={color}>{label}</Tag>;
}

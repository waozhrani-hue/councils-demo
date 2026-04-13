import { useState } from 'react';
import { Button, Space, Modal, Input, message } from 'antd';
import * as Icons from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAvailableActions, type AvailableAction } from '@/hooks/usePermissions';

const { TextArea } = Input;

// Map icon name string to actual icon component
function getIcon(iconName: string | null) {
  if (!iconName) return null;
  const IconComponent = (Icons as any)[iconName];
  return IconComponent ? <IconComponent /> : null;
}

function getButtonType(color: string): 'primary' | 'default' | 'dashed' | 'link' | 'text' {
  if (color === 'primary') return 'primary';
  return 'default';
}

interface Props {
  entityType: string;  // Topic, Meeting, Minutes
  entityId: string;
  onTransitionComplete?: () => void;
  invalidateKeys?: string[][];
}

export default function DynamicActionButtons({ entityType, entityId, onTransitionComplete, invalidateKeys }: Props) {
  const queryClient = useQueryClient();
  const { actions, isLoading } = useAvailableActions(entityType, entityId);
  const [reasonModal, setReasonModal] = useState<{ action: AvailableAction | null; visible: boolean }>({
    action: null,
    visible: false,
  });
  const [reason, setReason] = useState('');

  const transitionMutation = useMutation({
    mutationFn: (data: { action: string; reason?: string }) => {
      // Use the appropriate endpoint based on entity type
      const endpoints: Record<string, string> = {
        Topic: `/api/v1/topics/${entityId}/transition`,
        Meeting: `/api/v1/meetings/${entityId}/transition`,
        Minutes: `/api/v1/minutes/${entityId}/transition`,
      };
      return apiClient.post(endpoints[entityType] || endpoints.Topic, data);
    },
    onSuccess: () => {
      message.success('تم تنفيذ الإجراء بنجاح');
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['available-actions', entityType, entityId] });
      if (invalidateKeys) {
        invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
      }
      setReasonModal({ action: null, visible: false });
      setReason('');
      onTransitionComplete?.();
    },
    onError: (err: Error) => {
      message.error(err.message || 'فشل تنفيذ الإجراء');
    },
  });

  const handleAction = (action: AvailableAction) => {
    if (action.requiresReason) {
      setReasonModal({ action, visible: true });
    } else {
      transitionMutation.mutate({ action: action.actionCode });
    }
  };

  const confirmReasonAction = () => {
    if (!reason.trim()) {
      message.warning('يرجى إدخال السبب');
      return;
    }
    if (reasonModal.action) {
      transitionMutation.mutate({ action: reasonModal.action.actionCode, reason });
    }
  };

  if (isLoading || actions.length === 0) return null;

  return (
    <>
      <Space wrap>
        {actions.map((action) => (
          <Button
            key={action.actionCode}
            type={getButtonType(action.buttonColor)}
            danger={action.buttonColor === 'danger'}
            icon={getIcon(action.buttonIcon)}
            loading={transitionMutation.isPending}
            onClick={() => handleAction(action)}
          >
            {action.actionNameAr}
          </Button>
        ))}
      </Space>

      <Modal
        title="إدخال السبب"
        open={reasonModal.visible}
        onOk={confirmReasonAction}
        onCancel={() => {
          setReasonModal({ action: null, visible: false });
          setReason('');
        }}
        confirmLoading={transitionMutation.isPending}
        okText="تأكيد"
        cancelText="إلغاء"
      >
        <TextArea
          rows={4}
          placeholder="أدخل السبب"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Modal>
    </>
  );
}

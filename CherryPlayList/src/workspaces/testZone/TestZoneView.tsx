import React from 'react';

import { WorkspaceId } from '@core/types/workspace';

interface TestZoneViewProps {
  workspaceId: WorkspaceId;
  zoneId: string;
}

/**
 * Тестовый компонент для отображения тестовых зон
 */
export const TestZoneView: React.FC<TestZoneViewProps> = ({ workspaceId, zoneId }) => {
  return (
    <div
      style={{
        padding: '20px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-tertiary)',
        border: '2px dashed var(--ui-border)',
      }}
    >
      <h3 style={{ margin: '0 0 10px 0', color: 'var(--text-primary)' }}>
        Test Zone: {workspaceId}
      </h3>
      <p style={{ margin: '0', color: 'var(--text-secondary)', fontSize: '12px' }}>
        Zone ID: {zoneId}
      </p>
    </div>
  );
};

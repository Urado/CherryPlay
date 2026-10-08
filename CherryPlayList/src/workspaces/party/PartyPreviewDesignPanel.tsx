import React from 'react';

import { PartyEditor } from './components/PartyEditor';
import { usePartyWorkspaceRuntimeContext } from './partyWorkspaceRuntimeContext';
import { usePartySettingsFormState } from './usePartySettingsFormState';

interface PartyPreviewDesignPanelProps {
  hidden?: boolean;
}

export const PartyPreviewDesignPanel: React.FC<PartyPreviewDesignPanelProps> = ({ hidden = false }) => {
  const runtime = usePartyWorkspaceRuntimeContext();
  const form = usePartySettingsFormState(runtime);
  const designPhase = form.editorPhase ?? 'draft-unlinked';

  return (
    <aside id="party-preview-design-panel" className="party-preview-design-panel" hidden={hidden}>
      <PartyEditor
        phase={designPhase}
        section="design"
        fields={form.editorFields}
        handlers={form.editorHandlers}
        design={form.editorDesign}
        connection={form.editorConnection}
        isBlocked={form.isBlocked}
        defaultExpanded={true}
      />
    </aside>
  );
};

import React from 'react';

import { PartyEditor } from './components/PartyEditor';
import { PartyTrackDisplaySection } from './components/PartyTrackDisplaySection';
import { usePartyWorkspaceRuntimeContext } from './partyWorkspaceRuntimeContext';
import { usePartySettingsFormState } from './usePartySettingsFormState';

export const PartyPreviewDesignPanel: React.FC = () => {
  const runtime = usePartyWorkspaceRuntimeContext();
  const form = usePartySettingsFormState(runtime);

  if (!form.showTrackDisplay && form.editorPhase == null) {
    return null;
  }

  return (
    <aside className="party-preview-design-panel">
      {form.showTrackDisplay ? (
        <PartyTrackDisplaySection
          value={form.partyTrackDisplay}
          onChange={form.setPartyTrackDisplaySettings}
          defaultExpanded={true}
        />
      ) : null}
      {form.editorPhase ? (
        <PartyEditor
          phase={form.editorPhase}
          section="design"
          fields={form.editorFields}
          handlers={form.editorHandlers}
          design={form.editorDesign}
          connection={form.editorConnection}
          isBlocked={form.isBlocked}
          defaultExpanded={true}
        />
      ) : null}
    </aside>
  );
};

import type { PartyThemeId } from '@cherryplay/components';
import React from 'react';

import { PartyTrackDisplaySection } from './components/PartyTrackDisplaySection';
import { usePartyWorkspaceRuntimeContext } from './partyWorkspaceRuntimeContext';
import { usePartySettingsFormState } from './usePartySettingsFormState';

interface PartyPreviewDisplayPanelProps {
  themeId: PartyThemeId;
  hidden?: boolean;
}

export const PartyPreviewDisplayPanel: React.FC<PartyPreviewDisplayPanelProps> = ({
  themeId,
  hidden = false,
}) => {
  const runtime = usePartyWorkspaceRuntimeContext();
  const form = usePartySettingsFormState(runtime);

  return (
    <aside id="party-preview-display-panel" className="party-preview-design-panel" hidden={hidden}>
      {themeId === 'spring-cross-step' ? (
        <p className="party-preview-display-depth-note">
          Глубина групп не применяется к теме «Весенний кросс-степ».
        </p>
      ) : (
        <section className="party-preview-display-depth">
          <label htmlFor="party-preview-group-depth">Глубина отображения групп</label>
          <select
            id="party-preview-group-depth"
            value={form.groupDisplayDepth}
            onChange={(event) => form.setGroupDisplayDepth(Number(event.currentTarget.value))}
          >
            <option value={0}>Скрыть заголовки групп</option>
            {Array.from({ length: 10 }, (_, index) => index + 1).map((depth) => (
              <option key={depth} value={depth}>
                {depth} {depth === 1 ? 'уровень' : depth < 5 ? 'уровня' : 'уровней'}
              </option>
            ))}
          </select>
          <p>При превышении глубины верхние группы скрываются, содержимое остаётся.</p>
        </section>
      )}
      {form.showTrackDisplay ? (
        <PartyTrackDisplaySection
          value={form.partyTrackDisplay}
          onChange={form.setPartyTrackDisplaySettings}
          defaultExpanded={true}
        />
      ) : null}
    </aside>
  );
};

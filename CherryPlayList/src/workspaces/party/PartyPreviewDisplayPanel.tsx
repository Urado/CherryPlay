import type { PartyThemeId } from '@cherryplay/components';
import { useProjectStore } from '@shared/stores/projectStore';
import React from 'react';

import { PartyEditorAccordion } from './components/PartyEditorAccordion';
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
  const springTheme = themeId === 'spring-cross-step';
  const partyTrackDisplay = useProjectStore((state) => state.meta.partyTrackDisplay);
  const setPartyTrackDisplaySettings = useProjectStore(
    (state) => state.setPartyTrackDisplaySettings,
  );

  return (
    <aside id="party-preview-display-panel" className="party-preview-design-panel" hidden={hidden}>
      <div className="party-preview-display-panel">
        <PartyEditorAccordion title="Заголовки">
          <div className="party-editor-fields-group__fields party-editor-fields-group__fields--single">
            <label className="party-editor-label">
              Заголовок страницы
              <input
                type="text"
                className="party-editor-input"
                value={form.editorFields.partyTitle}
                onChange={(event) => form.editorHandlers.onPartyTitleChange(event.target.value)}
                placeholder="Если пусто — название проекта"
              />
            </label>
            <label className="party-editor-label">
              Подзаголовок
              <input
                type="text"
                className="party-editor-input"
                value={form.editorFields.partySubtitle}
                onChange={(event) => form.editorHandlers.onPartySubtitleChange(event.target.value)}
                placeholder="Строка под заголовком"
              />
            </label>
          </div>
        </PartyEditorAccordion>
        <PartyEditorAccordion title="Названия треков">
          <PartyTrackDisplaySection
            value={partyTrackDisplay}
            onChange={setPartyTrackDisplaySettings}
          />
        </PartyEditorAccordion>
        <PartyEditorAccordion title="Группы" defaultExpanded={true}>
          {springTheme ? (
            <p className="party-preview-display-depth-note">
              Глубина групп не применяется к теме «Весенний кросс-степ».
            </p>
          ) : (
            <div className="party-preview-display-depth">
              <label htmlFor="party-preview-group-depth">Уровень вложенности</label>
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
            </div>
          )}
        </PartyEditorAccordion>
      </div>
    </aside>
  );
};

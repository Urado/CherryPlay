import React from 'react';

import { PartyEditorAccordion } from './PartyEditorAccordion';

import './PartyEditor.css';

export interface PartyExtendedFieldsSectionProps {
  description: string;
  place: string;
  schedule: string;
  readOnly?: boolean;
  defaultExpanded?: boolean;
  onDescriptionChange?: (description: string) => void;
  onPlaceChange?: (place: string) => void;
  onScheduleChange?: (schedule: string) => void;
}

export const PartyExtendedFieldsSection: React.FC<PartyExtendedFieldsSectionProps> = ({
  description,
  place,
  schedule,
  readOnly = false,
  defaultExpanded = false,
  onDescriptionChange,
  onPlaceChange,
  onScheduleChange,
}) => {
  return (
    <PartyEditorAccordion title="Дополнительные данные" defaultExpanded={defaultExpanded}>
      {onPlaceChange && (
        <div className="party-editor-fields-group">
          <h4 className="party-editor-fields-group__title">Место проведения</h4>
          <div className="party-editor-fields-group__fields">
            <div className="party-editor-section">
              <label className="party-editor-label">
                Место
                <input
                  type="text"
                  className="party-editor-input"
                  value={place}
                  onChange={(e) => onPlaceChange(e.target.value)}
                  placeholder="Место проведения"
                  readOnly={readOnly}
                  disabled={readOnly}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {onDescriptionChange && onScheduleChange && (
        <div className="party-editor-fields-group">
          <h4 className="party-editor-fields-group__title">Описание и программа</h4>
          <div className="party-editor-fields-group__fields">
            <div className="party-editor-section">
              <label className="party-editor-label">
                Описание
                <textarea
                  className="party-editor-input"
                  value={description}
                  onChange={(e) => onDescriptionChange(e.target.value)}
                  placeholder="Описание вечеринки"
                  rows={3}
                  readOnly={readOnly}
                  disabled={readOnly}
                />
              </label>
            </div>
            <div className="party-editor-section">
              <label className="party-editor-label">
                Расписание
                <textarea
                  className="party-editor-input"
                  value={schedule}
                  onChange={(e) => onScheduleChange(e.target.value)}
                  placeholder="Расписание мероприятия"
                  rows={3}
                  readOnly={readOnly}
                  disabled={readOnly}
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </PartyEditorAccordion>
  );
};

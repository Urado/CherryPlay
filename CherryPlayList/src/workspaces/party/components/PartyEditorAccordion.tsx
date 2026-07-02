import React, { useId, useState } from 'react';

import './PartyEditorAccordion.css';

export interface PartyEditorAccordionProps {
  title: string;
  defaultExpanded?: boolean;
  summary?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export const PartyEditorAccordion: React.FC<PartyEditorAccordionProps> = ({
  title,
  defaultExpanded = false,
  summary,
  className = '',
  children,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const panelId = useId();
  const headingId = useId();

  return (
    <section
      className={`party-editor-accordion${isExpanded ? '' : ' party-editor-accordion--collapsed'} ${className}`.trim()}
      aria-labelledby={headingId}
    >
      <div className="party-editor-accordion__header">
        <h3 id={headingId} className="party-editor-accordion__heading">
          <button
            type="button"
            className="party-editor-accordion__toggle"
            aria-expanded={isExpanded}
            aria-controls={panelId}
            aria-labelledby={headingId}
            onClick={() => setIsExpanded((open) => !open)}
          >
            <span className="party-editor-accordion__title">{title}</span>
            <span className="party-editor-accordion__chevron" aria-hidden="true">
              {isExpanded ? '▾' : '▸'}
            </span>
          </button>
        </h3>
        {!isExpanded && summary != null && summary !== '' && (
          <span className="party-editor-accordion__summary">{summary}</span>
        )}
      </div>

      {isExpanded && (
        <div id={panelId} className="party-editor-accordion__panel">
          {children}
        </div>
      )}
    </section>
  );
};

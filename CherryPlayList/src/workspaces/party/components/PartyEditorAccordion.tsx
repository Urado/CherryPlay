import { Disclosure } from '@cherryplay/components';
import React from 'react';

import './PartyEditorFieldsGroup.css';

export interface PartyEditorAccordionProps {
  title: string;
  variant?: 'flat' | 'card';
  defaultExpanded?: boolean;
  summary?: React.ReactNode;
  headerTrailing?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  sectionRef?: React.Ref<HTMLElement>;
}

export const PartyEditorAccordion: React.FC<PartyEditorAccordionProps> = ({
  title,
  variant = 'flat',
  defaultExpanded = false,
  summary,
  headerTrailing,
  className = '',
  children,
  expanded,
  onExpandedChange,
  sectionRef,
}) => {
  return (
    <Disclosure
      title={title}
      variant={variant}
      defaultExpanded={defaultExpanded}
      summary={summary}
      headerTrailing={headerTrailing}
      className={className}
      expanded={expanded}
      onExpandedChange={onExpandedChange}
    >
      <div className="party-editor-accordion-content" ref={sectionRef as React.Ref<HTMLDivElement>}>
        {children}
      </div>
    </Disclosure>
  );
};

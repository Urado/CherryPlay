import { Disclosure } from '@cherryplay/components';
import React from 'react';

import './PartyEditorFieldsGroup.css';

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
  return (
    <Disclosure
      title={title}
      variant="flat"
      defaultExpanded={defaultExpanded}
      summary={summary}
      className={className}
    >
      {children}
    </Disclosure>
  );
};

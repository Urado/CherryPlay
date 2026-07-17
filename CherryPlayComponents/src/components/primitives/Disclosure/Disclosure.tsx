import React, { useCallback, useId, useState } from 'react';

import { cn } from '../../../utils/cn';

import './Disclosure.css';

export type DisclosureVariant = 'flat' | 'card';

export interface DisclosureProps {
  title: string;
  variant?: DisclosureVariant;
  defaultExpanded?: boolean;
  summary?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

function hasSummary(summary: React.ReactNode): boolean {
  return summary != null && summary !== '';
}

export const Disclosure: React.FC<DisclosureProps> = ({
  title,
  variant = 'flat',
  defaultExpanded = false,
  summary,
  className = '',
  children,
  expanded: expandedProp,
  onExpandedChange,
}) => {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isControlled = expandedProp !== undefined;
  const isExpanded = isControlled ? expandedProp : internalExpanded;
  const panelId = useId();
  const headingId = useId();

  const toggle = useCallback(() => {
    const next = !isExpanded;
    if (!isControlled) {
      setInternalExpanded(next);
    }
    onExpandedChange?.(next);
  }, [isControlled, isExpanded, onExpandedChange]);

  return (
    <section
      className={cn(
        'cp-disclosure',
        `cp-disclosure--${variant}`,
        !isExpanded && 'cp-disclosure--collapsed',
        className,
      )}
      aria-labelledby={headingId}
    >
      <div className="cp-disclosure__header">
        <h3 id={headingId} className="cp-disclosure__heading">
          <button
            type="button"
            className="cp-disclosure__toggle"
            aria-expanded={isExpanded}
            aria-controls={panelId}
            onClick={toggle}
          >
            <span className="cp-disclosure__title">{title}</span>
            <span className="cp-disclosure__chevron" aria-hidden="true">
              {isExpanded ? '▾' : '▸'}
            </span>
          </button>
        </h3>
        {!isExpanded && hasSummary(summary) && (
          <span className="cp-disclosure__summary">{summary}</span>
        )}
      </div>

      <div
        id={panelId}
        className="cp-disclosure__panel"
        role="region"
        aria-labelledby={headingId}
        hidden={!isExpanded}
        aria-hidden={!isExpanded}
      >
        {children}
      </div>
    </section>
  );
};

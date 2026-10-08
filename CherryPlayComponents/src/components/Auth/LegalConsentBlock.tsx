import React, { useId } from 'react';

import { LEGAL_PD_CONSENT, LEGAL_TERMS } from '../../constants/legalDocuments';
import './LegalConsentBlock.css';

export interface LegalConsentBlockProps {
  pdConsentAccepted: boolean;
  termsAccepted: boolean;
  onPdConsentChange: (accepted: boolean) => void;
  onTermsChange: (accepted: boolean) => void;
  disabled?: boolean;
}

export const LegalConsentBlock: React.FC<LegalConsentBlockProps> = ({
  pdConsentAccepted,
  termsAccepted,
  onPdConsentChange,
  onTermsChange,
  disabled = false,
}) => {
  return (
    <div className="legal-consent-block" role="group" aria-label="Юридические согласия">
      <ConsentItem
        checked={termsAccepted}
        disabled={disabled}
        onChange={onTermsChange}
        archivePath={LEGAL_TERMS.archivePath}
        checkboxLabel={LEGAL_TERMS.checkboxLabel}
        summary={LEGAL_TERMS.summary}
        consentKey="terms"
      />
      <ConsentItem
        checked={pdConsentAccepted}
        disabled={disabled}
        onChange={onPdConsentChange}
        archivePath={LEGAL_PD_CONSENT.archivePath}
        checkboxLabel={LEGAL_PD_CONSENT.checkboxLabel}
        summary={LEGAL_PD_CONSENT.summary}
        consentKey="pd"
      />
    </div>
  );
};

interface ConsentItemProps {
  checked: boolean;
  disabled: boolean;
  onChange: (accepted: boolean) => void;
  archivePath: string;
  checkboxLabel: string;
  summary: string;
  consentKey: 'pd' | 'terms';
}

const ConsentItem = ({
  checked,
  disabled,
  onChange,
  archivePath,
  checkboxLabel,
  summary,
  consentKey,
}: ConsentItemProps) => {
  const id = useId();
  const summaryId = useId();

  return (
    <div className="legal-consent-item">
      <input
        id={id}
        className="legal-consent-checkbox"
        type="checkbox"
        checked={checked}
        disabled={disabled}
        data-legal-consent={consentKey}
        aria-describedby={summaryId}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="legal-consent-label-text">
        <label className="legal-consent-label" htmlFor={id}>
          {checkboxLabel}
        </label>
        <p id={summaryId} className="legal-consent-summary">
          {summary}
        </p>
        <a
          className="legal-consent-link"
          href={archivePath}
          target="_blank"
          rel="noopener noreferrer"
        >
          Полный текст
        </a>
      </div>
    </div>
  );
}

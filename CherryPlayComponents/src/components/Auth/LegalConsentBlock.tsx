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
        currentPath={LEGAL_TERMS.currentPath}
        linkText="Пользовательского соглашения"
        accessibleName="Я принимаю условия Пользовательского соглашения"
        consentKey="terms"
      >
        Я принимаю условия{' '}
      </ConsentItem>
      <ConsentItem
        checked={pdConsentAccepted}
        disabled={disabled}
        onChange={onPdConsentChange}
        currentPath={LEGAL_PD_CONSENT.currentPath}
        linkText="текстом согласия"
        accessibleName="Я даю согласие на обработку персональных данных в соответствии с текстом согласия"
        consentKey="pd"
      >
        Я даю согласие на обработку персональных данных в соответствии с{' '}
      </ConsentItem>
    </div>
  );
};

interface ConsentItemProps {
  checked: boolean;
  disabled: boolean;
  onChange: (accepted: boolean) => void;
  currentPath: string;
  linkText: string;
  accessibleName: string;
  consentKey: 'pd' | 'terms';
  children: React.ReactNode;
}

const ConsentItem = ({
  checked,
  disabled,
  onChange,
  currentPath,
  linkText,
  accessibleName,
  consentKey,
  children,
}: ConsentItemProps) => {
  const id = useId();

  return (
    <div className="legal-consent-item">
      <input
        id={id}
        className="legal-consent-checkbox"
        type="checkbox"
        checked={checked}
        disabled={disabled}
        data-legal-consent={consentKey}
        aria-label={accessibleName}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="legal-consent-label-text">
        <label className="legal-consent-label" htmlFor={id}>
          {children}
        </label>
        <a
          className="legal-consent-link"
          href={currentPath}
          target="_blank"
          rel="noopener noreferrer"
        >
          {linkText}
        </a>
      </span>
    </div>
  );
}

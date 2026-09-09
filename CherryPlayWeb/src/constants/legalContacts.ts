import { LEGAL_OPERATOR_CONTENT } from '../content/legal/documents';

const envPrivacy = import.meta.env.VITE_PRIVACY_CONTACT?.trim();
const envSupport = import.meta.env.VITE_SUPPORT_CONTACT?.trim();

export const PRIVACY_CONTACT_EMAIL =
  envPrivacy && envPrivacy.length > 0
    ? envPrivacy
    : LEGAL_OPERATOR_CONTENT.privacyContact;

export const SUPPORT_CONTACT_EMAIL =
  envSupport && envSupport.length > 0
    ? envSupport
    : LEGAL_OPERATOR_CONTENT.generalContact;

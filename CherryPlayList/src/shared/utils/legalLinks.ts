export type LegalDocument = 'privacy' | 'legal';

const LEGAL_DOCUMENT_PATHS: Record<LegalDocument, string> = {
  privacy: '/privacy',
  legal: '/legal',
};

export function resolveLegalWebBaseUrl(configuredWebBaseUrl: string, override?: string): string {
  const selectedBaseUrl = override?.trim() || configuredWebBaseUrl.trim();
  const baseUrl = new URL(selectedBaseUrl);
  if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password) {
    throw new Error('Недопустимый адрес сайта');
  }

  return baseUrl.origin;
}

export function buildLegalDocumentUrl(webBaseUrl: string, document: LegalDocument): string {
  const baseUrl = new URL(resolveLegalWebBaseUrl(webBaseUrl));

  baseUrl.pathname = LEGAL_DOCUMENT_PATHS[document];
  baseUrl.search = '';
  baseUrl.hash = '';
  return baseUrl.toString();
}

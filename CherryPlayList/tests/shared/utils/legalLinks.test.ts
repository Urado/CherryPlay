import {
  buildLegalDocumentUrl,
  resolveLegalWebBaseUrl,
} from '../../../src/shared/utils/legalLinks';

describe('buildLegalDocumentUrl', () => {
  it('builds legal document URLs from the configured web base', () => {
    expect(buildLegalDocumentUrl('https://example.test/nested/', 'privacy')).toBe(
      'https://example.test/privacy',
    );
    expect(buildLegalDocumentUrl('http://localhost:3000', 'legal')).toBe(
      'http://localhost:3000/legal',
    );
  });

  it('uses configured development and production bases unless a staging override is set', () => {
    const developmentBase = resolveLegalWebBaseUrl('http://localhost:3000');
    const productionBase = resolveLegalWebBaseUrl('https://cherrypashkaparty.ru');
    const stagingBase = resolveLegalWebBaseUrl(
      'http://localhost:3000',
      'https://staging.example.test',
    );

    expect(buildLegalDocumentUrl(developmentBase, 'privacy')).toBe('http://localhost:3000/privacy');
    expect(buildLegalDocumentUrl(productionBase, 'legal')).toBe(
      'https://cherrypashkaparty.ru/legal',
    );
    expect(buildLegalDocumentUrl(stagingBase, 'privacy')).toBe(
      'https://staging.example.test/privacy',
    );
  });

  it('rejects non-web schemes and credentials', () => {
    expect(() => buildLegalDocumentUrl('javascript:alert(1)', 'privacy')).toThrow();
    expect(() => buildLegalDocumentUrl('https://user:pass@example.test', 'legal')).toThrow();
  });
});

import { describe, expect, it } from 'vitest';

import { formatConsentDecisionLabel } from './consentDecisionLabel';

describe('formatConsentDecisionLabel', () => {
  it('maps grant/withdraw/missing to Russian labels', () => {
    expect(formatConsentDecisionLabel('grant')).toBe('принято');
    expect(formatConsentDecisionLabel('withdraw')).toBe('отозвано');
    expect(formatConsentDecisionLabel(undefined)).toBe('нет записи');
    expect(formatConsentDecisionLabel(null)).toBe('нет записи');
    expect(formatConsentDecisionLabel('other')).toBe('нет записи');
  });
});

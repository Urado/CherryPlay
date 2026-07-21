import { constantTimeStringEqual } from '../../../src/shared/utils/tokenUtils';

describe('constantTimeStringEqual', () => {
  it('returns true for equal strings', () => {
    expect(constantTimeStringEqual('secret-token', 'secret-token')).toBe(true);
    expect(constantTimeStringEqual('', '')).toBe(true);
  });

  it('returns false for different characters with same length', () => {
    expect(constantTimeStringEqual('secret-token', 'secret-tokem')).toBe(false);
    expect(constantTimeStringEqual('abc', 'abd')).toBe(false);
  });

  it('returns false for different lengths', () => {
    expect(constantTimeStringEqual('short', 'longer-string')).toBe(false);
    expect(constantTimeStringEqual('longer-string', 'short')).toBe(false);
    expect(constantTimeStringEqual('', 'non-empty')).toBe(false);
    expect(constantTimeStringEqual('non-empty', '')).toBe(false);
  });

  it('returns false for empty vs non-empty strings', () => {
    expect(constantTimeStringEqual('', 'a')).toBe(false);
    expect(constantTimeStringEqual('a', '')).toBe(false);
  });
});

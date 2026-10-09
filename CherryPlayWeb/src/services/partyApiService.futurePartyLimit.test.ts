import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FuturePartyLimitReachedError, partyApiService } from './partyApiService';

const FUTURE_PARTY_LIMIT_MESSAGE =
  'Достигнут лимит: не больше 2 будущих вечеринок. Новую будущую вечеринку создать нельзя, и прошедшую нельзя перенести в будущее.';

const mockResponse = (status: number, body: unknown): Response => {
  const text = JSON.stringify(body);
  const response = {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 403 ? 'Forbidden' : 'OK',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(text),
    clone: () => mockResponse(status, body),
  };

  return response as Response;
};

describe('partyApiService future party limit', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('maps create 403 future_party_limit_reached to a Russian limit error', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(403, {
        code: 'future_party_limit_reached',
        message: 'Limit of 2 future parties per organizer reached.',
        limit: 2,
      }),
    );

    const error = await partyApiService
      .createParty({ name: 'Новая', partyThemeId: 'default' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(FuturePartyLimitReachedError);
    expect(error).toMatchObject({
      name: 'FuturePartyLimitReachedError',
      code: 'future_party_limit_reached',
      limit: 2,
      message: FUTURE_PARTY_LIMIT_MESSAGE,
    });
  });

  it('maps update 403 future_party_limit_reached to the same Russian limit error', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(403, {
        code: 'future_party_limit_reached',
        message: 'Limit of 2 future parties per organizer reached.',
        limit: 2,
      }),
    );

    const error = await partyApiService
      .updatePartyMetadata('party-1', { eventDateTime: '2026-12-01T18:00:00Z' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(FuturePartyLimitReachedError);
    expect(error).toMatchObject({
      limit: 2,
      message: FUTURE_PARTY_LIMIT_MESSAGE,
    });
  });

  it('uses 2 when the limit field is missing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(403, {
        code: 'future_party_limit_reached',
        message: 'Limit of 2 future parties per organizer reached.',
      }),
    );

    const error = await partyApiService
      .createParty({ name: 'Новая', partyThemeId: 'default' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(FuturePartyLimitReachedError);
    expect((error as FuturePartyLimitReachedError).limit).toBe(2);
    expect((error as FuturePartyLimitReachedError).message).toBe(FUTURE_PARTY_LIMIT_MESSAGE);
  });
});

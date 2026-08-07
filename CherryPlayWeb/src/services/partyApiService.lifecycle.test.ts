import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PartyDto } from '../types/api';

import { InvalidPartyLifecycleTransitionError, partyApiService } from './partyApiService';

function mockResponse(status: number, body: unknown): Response {
  const text = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 409 ? 'Conflict' : status === 200 ? 'OK' : 'Error',
    json: async () => body,
    text: async () => text,
  } as Response;
}

const sampleParty: PartyDto = {
  id: 'party-1',
  name: 'Test Party',
  partyThemeId: 'default',
  partyLifecycleState: 'ready',
  shortCode: 'abc123',
  isListedInCatalog: true,
  createdAt: '2026-01-01T00:00:00Z',
  hasActiveSession: false,
};

describe('partyApiService.transitionPartyLifecycle', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns PartyDto on successful transition', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(200, sampleParty));

    const result = await partyApiService.transitionPartyLifecycle('party-1', 'ready');

    expect(result).toEqual(sampleParty);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/parties/party-1/lifecycle'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ partyLifecycleState: 'ready' }),
      }),
    );
  });

  it('throws InvalidPartyLifecycleTransitionError for completed → ready (409)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(409, {
        code: 'invalid_lifecycle_transition',
        detail: 'Нельзя перевести вечеринку из «Завершена» в «Ждёт начала».',
        currentState: 'completed',
        requestedState: 'ready',
      }),
    );

    await expect(
      partyApiService.transitionPartyLifecycle('party-1', 'ready'),
    ).rejects.toMatchObject({
      name: 'InvalidPartyLifecycleTransitionError',
      code: 'invalid_lifecycle_transition',
      currentState: 'completed',
      requestedState: 'ready',
    });
  });

  it('throws InvalidPartyLifecycleTransitionError for ready → draft (409)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(409, {
        code: 'invalid_lifecycle_transition',
        detail: 'Нельзя перевести вечеринку из «Ждёт начала» в «Черновик».',
        currentState: 'ready',
        requestedState: 'draft',
      }),
    );

    const error = await partyApiService
      .transitionPartyLifecycle('party-1', 'draft')
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(InvalidPartyLifecycleTransitionError);
    expect(error.currentState).toBe('ready');
    expect(error.requestedState).toBe('draft');
  });

  it('throws InvalidPartyLifecycleTransitionError for draft → completed without ready (409)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(409, {
        code: 'invalid_lifecycle_transition',
        detail: 'Нельзя перевести вечеринку из «Черновик» в «Завершена».',
        currentState: 'draft',
        requestedState: 'completed',
      }),
    );

    await expect(
      partyApiService.transitionPartyLifecycle('party-1', 'completed'),
    ).rejects.toBeInstanceOf(InvalidPartyLifecycleTransitionError);
  });

  it('defaults missing lifecycle states to draft in 409 payload', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(409, {
        code: 'invalid_lifecycle_transition',
        detail: 'Недопустимый переход.',
      }),
    );

    const error = await partyApiService
      .transitionPartyLifecycle('party-1', 'ready')
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(InvalidPartyLifecycleTransitionError);
    expect(error.currentState).toBe('draft');
    expect(error.requestedState).toBe('draft');
  });
});

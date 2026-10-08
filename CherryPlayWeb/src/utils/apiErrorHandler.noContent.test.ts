import { describe, expect, it } from 'vitest';

import { handleApiResponse } from './apiErrorHandler';

describe('handleApiResponse', () => {
  it('accepts a successful 204 response without a JSON body', async () => {
    const response = new Response(null, { status: 204 });

    await expect(handleApiResponse<void>(response, 'Ошибка запроса')).resolves.toBeUndefined();
  });
});

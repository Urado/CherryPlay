import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';

import { PartyCatalogVisibilityControl } from '../../src/workspaces/party/components/PartyCatalogVisibilityControl';
import { PartyGeneralSection } from '../../src/workspaces/party/components/PartyGeneralSection';

jest.mock('../../src/app/components/ProjectNameInput', () => ({
  ProjectNameInput: ({ disabled }: { disabled: boolean }) => (
    <input aria-label="Название проекта" disabled={disabled} />
  ),
}));

describe('always-visible project settings', () => {
  it('shows project, guest link and visibility together without a disclosure toggle', () => {
    const onCopyUrl = jest.fn();
    const onVisibilityChange = jest.fn();
    render(
      <PartyGeneralSection
        partyUrl="https://example.com/party/test"
        showCopyUrl
        onCopyUrl={onCopyUrl}
        catalogVisibilityControl={
          <PartyCatalogVisibilityControl
            layout="header"
            isListedInCatalog={false}
            onChange={onVisibilityChange}
          />
        }
      />,
    );

    const general = within(screen.getByRole('region', { name: 'Настройки проекта' }));
    expect(general.getByRole('textbox', { name: 'Название проекта' })).toBeVisible();
    expect(general.getByRole('textbox', { name: 'Ссылка для гостей' })).toBeVisible();
    expect(general.getAllByRole('radiogroup')).toHaveLength(1);

    fireEvent.click(general.getByRole('radio', { name: 'В каталоге' }));
    fireEvent.click(general.getByRole('button', { name: 'Скопировать' }));

    expect(onVisibilityChange).toHaveBeenCalledWith(true);
    expect(onCopyUrl).toHaveBeenCalledTimes(1);
  });
});

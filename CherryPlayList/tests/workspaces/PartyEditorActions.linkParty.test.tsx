import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { PartyEditorActions } from '../../src/workspaces/party/components/PartyEditorActions';

describe('PartyEditorActions party linking', () => {
  it('offers linking alongside create in the unlinked create context', () => {
    const onCreateParty = jest.fn();
    const onOpenLinkParty = jest.fn();

    render(
      <PartyEditorActions
        phase="draft-unlinked"
        isAuthenticated={true}
        isCreating={false}
        onCreateParty={onCreateParty}
        onOpenLinkParty={onOpenLinkParty}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Привязать' }));

    expect(screen.getByRole('button', { name: 'Создать' })).toBeVisible();
    expect(onOpenLinkParty).toHaveBeenCalledTimes(1);
    expect(onCreateParty).not.toHaveBeenCalled();
  });

  it('offers linking in the existing party edit context', () => {
    const onOpenLinkParty = jest.fn();

    render(
      <PartyEditorActions
        phase="ready"
        isAuthenticated={true}
        isCreating={false}
        showSave={true}
        onSaveMetadata={jest.fn()}
        onOpenLinkParty={onOpenLinkParty}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Привязать' }));

    expect(screen.getByRole('button', { name: 'Обновить' })).toBeVisible();
    expect(onOpenLinkParty).toHaveBeenCalledTimes(1);
  });
});

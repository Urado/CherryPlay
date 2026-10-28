import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { CollectionPicker } from '../../src/workspaces/collection/CollectionPicker';

describe('collection picker header layout', () => {
  it('renders the menu outside clipping workspace containers with fixed positioning', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <div className="workspace-zone" style={{ overflow: 'hidden' }}>
        <CollectionPicker
          collectionId="current"
          name="Вечерний сет"
          collections={[{ id: 'current', name: 'Вечерний сет' }]}
          onSelect={jest.fn()}
          onCreate={jest.fn()}
          onRename={jest.fn()}
        />
      </div>,
    );

    await user.click(screen.getByRole('button', { name: 'Подборка: Вечерний сет' }));

    const menu = screen.getByRole('menu', { name: 'Подборки проекта' });
    expect(document.body).toContainElement(menu);
    expect(container).not.toContainElement(menu);
    expect(menu).toHaveStyle({ position: 'fixed' });
  });

  it('allows collection toolbar content to overflow', () => {
    const stylesheetPath = resolve(__dirname, '../../src/styles/components/playlist.css');
    const stylesheet = readFileSync(stylesheetPath, 'utf8');
    const collectionToolbarRule = stylesheet.match(
      /\.collection-header \.playlist-header-toolbar__primary\s*\{([^}]*)\}/,
    );

    expect(collectionToolbarRule?.[1]).toMatch(/overflow:\s*visible/);
  });

  it('allocates row width to collection names when delete controls are present', () => {
    const stylesheetPath = resolve(__dirname, '../../src/styles/components/header.css');
    const stylesheet = readFileSync(stylesheetPath, 'utf8');
    const collectionNameRule = stylesheet.match(
      /\.collection-picker__select \.workspace-menu__item-label-text\s*\{([^}]*)\}/,
    );
    const genericItemRule = stylesheet.match(/\.workspace-menu__item\s*\{([^}]*)\}/);
    const deleteItemRule = stylesheet.match(
      /\.workspace-menu__item\.collection-picker__delete\s*\{([^}]*)\}/,
    );
    const panelRule = stylesheet.match(/\.collection-picker__panel\s*\{([^}]*)\}/);

    expect(collectionNameRule?.[1]).toMatch(/flex:\s*1 1 auto/);
    expect(collectionNameRule?.[1]).toMatch(/text-align:\s*left/);
    expect(genericItemRule?.[1]).toMatch(/width:\s*100%/);
    expect(deleteItemRule?.[1]).toMatch(/width:\s*auto/);
    expect(deleteItemRule?.[1]).toMatch(/flex:\s*0 0 auto/);
    expect(panelRule?.[1]).toMatch(/width:\s*100%/);
    expect(panelRule?.[1]).toMatch(/min-width:\s*0/);
    expect(panelRule?.[1]).toMatch(/max-width:\s*calc\(100vw - 24px\)/);
  });
});

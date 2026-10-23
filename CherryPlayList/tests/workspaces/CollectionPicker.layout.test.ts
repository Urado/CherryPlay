import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('collection picker header layout', () => {
  it('lifts every clipping workspace ancestor while the menu is open', () => {
    const stylesheetPath = resolve(__dirname, '../../src/styles/components/playlist.css');
    const stylesheet = readFileSync(stylesheetPath, 'utf8');
    const collectionToolbarRule = stylesheet.match(
      /\.collection-header \.playlist-header-toolbar__primary\s*\{([^}]*)\}/,
    );
    const openMenuAncestorRule = stylesheet.match(
      /\.split-zone:has\(\.collection-picker--open\),\s*\.split-container:has\(\.collection-picker--open\),\s*\.workspace-zone:has\(\.collection-picker--open\),\s*\.workspace-zone__body:has\(\.collection-picker--open\),\s*\.playlist-view:has\(\.collection-picker--open\)\s*\{([^}]*)\}/,
    );

    expect(collectionToolbarRule?.[1]).toMatch(/overflow:\s*visible/);
    expect(openMenuAncestorRule?.[1]).toMatch(/overflow:\s*visible/);
    expect(openMenuAncestorRule?.[1]).toMatch(/z-index:\s*10/);
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

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { PartyPreviewDesignNav } from '../../src/workspaces/party/components/PartyPreviewDesignNav';

describe('PartyPreviewDesignNav', () => {
  it('exposes the current panel state and reports close requests', () => {
    const onToggle = jest.fn();
    render(<PartyPreviewDesignNav open onToggle={onToggle} />);

    const toggle = screen.getByRole('button', { name: 'Свернуть панель дизайна' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('reports the open state when the design panel is closed', () => {
    render(<PartyPreviewDesignNav open={false} onToggle={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Открыть дизайн' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});

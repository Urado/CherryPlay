import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import React from 'react';

import { PartyTrackDisplaySection } from '../../src/workspaces/party/components/PartyTrackDisplaySection';

describe('PartyTrackDisplaySection', () => {
  it('shows strip-leading-chars controls without an accordion when settings are empty', () => {
    render(<PartyTrackDisplaySection value={{}} onChange={jest.fn()} />);

    expect(screen.getByText('Скрыть символы с начала имени трека')).toBeVisible();
    expect(screen.getByRole('checkbox')).toBeVisible();
    expect(screen.getByText('Число символов')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Отображение треков/ })).not.toBeInTheDocument();
  });
});

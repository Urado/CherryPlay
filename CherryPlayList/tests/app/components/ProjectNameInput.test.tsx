import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';

let mockProjectName = 'Saved project';
let mockHasHydrated = false;
let mockOnFinishHydration: (() => void) | null = null;
const mockSetName = jest.fn((name: string) => {
  mockProjectName = name;
});

jest.mock('@shared/stores', () => ({
  useProjectStore: Object.assign(
    (selector: (state: { name: string; setName: typeof mockSetName }) => unknown) =>
      selector({ name: mockProjectName, setName: mockSetName }),
    {
      persist: {
        hasHydrated: () => mockHasHydrated,
        onFinishHydration: (listener: () => void) => {
          mockOnFinishHydration = listener;
          return () => {
            mockOnFinishHydration = null;
          };
        },
      },
    },
  ),
}));

import { ProjectNameInput } from '@app/components/ProjectNameInput';

describe('ProjectNameInput', () => {
  beforeEach(() => {
    mockProjectName = 'Saved project';
    mockHasHydrated = false;
    mockOnFinishHydration = null;
    mockSetName.mockClear();
  });

  it('keeps project name editing disabled until persisted state is hydrated', () => {
    render(<ProjectNameInput disabled={false} title="Название проекта" />);
    const input = screen.getByRole('textbox', { name: 'Название проекта' });

    expect(input).toBeDisabled();
    expect(input).toHaveAttribute('aria-busy', 'true');

    act(() => {
      mockHasHydrated = true;
      mockOnFinishHydration?.();
    });

    expect(input).toBeEnabled();
    expect(input).toHaveAttribute('aria-busy', 'false');
  });

  it('writes edits to the project store after hydration', () => {
    mockHasHydrated = true;
    render(<ProjectNameInput disabled={false} title="Название проекта" />);
    const input = screen.getByRole('textbox', { name: 'Название проекта' });

    fireEvent.change(input, { target: { value: 'Renamed project' } });

    expect(mockSetName).toHaveBeenCalledWith('Renamed project');
  });
});

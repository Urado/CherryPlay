import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';

import { DEFAULT_PARTY_TRACK_DISPLAY_SETTINGS } from '../../src/core/types/project';
import { PartyTrackDisplaySection } from '../../src/workspaces/party/components/PartyTrackDisplaySection';

const buildSettings = (delimiter: string) => ({
  ...DEFAULT_PARTY_TRACK_DISPLAY_SETTINGS,
  stripLeadingCharsEnabled: true,
  stripLeadingCharsMode: 'untilDelimiter' as const,
  stripLeadingCharsDelimiter: delimiter,
});

const ControlledPartyTrackDisplaySection: React.FC<{
  initialValue: ReturnType<typeof buildSettings>;
  onChange?: jest.Mock;
}> = ({ initialValue, onChange = jest.fn() }) => {
  const [value, setValue] = useState(initialValue);
  return (
    <PartyTrackDisplaySection
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
};

describe('PartyTrackDisplaySection custom delimiter', () => {
  it('shows the custom character field when another character is selected', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <ControlledPartyTrackDisplaySection initialValue={buildSettings(' ')} onChange={onChange} />,
    );

    await user.selectOptions(screen.getByRole('combobox', { name: 'Разделитель' }), 'custom');

    expect(screen.getByLabelText('Свой символ')).toHaveValue('');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('saves a custom character while keeping it selected', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <ControlledPartyTrackDisplaySection initialValue={buildSettings(' ')} onChange={onChange} />,
    );

    await user.selectOptions(screen.getByRole('combobox', { name: 'Разделитель' }), 'custom');
    await user.type(screen.getByLabelText('Свой символ'), '|');

    expect(onChange).toHaveBeenLastCalledWith(buildSettings('|'));
    expect(screen.getByRole('combobox', { name: 'Разделитель' })).toHaveValue('custom');
    expect(screen.getByLabelText('Свой символ')).toHaveValue('|');
  });

  it('allows clearing and replacing the custom character', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <ControlledPartyTrackDisplaySection initialValue={buildSettings('|')} onChange={onChange} />,
    );

    const customInput = screen.getByLabelText('Свой символ');
    await user.clear(customInput);
    await user.type(customInput, '#');

    expect(onChange).toHaveBeenLastCalledWith(buildSettings('#'));
    expect(customInput).toHaveValue('#');
  });

  it('persists an em dash as a custom delimiter', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <ControlledPartyTrackDisplaySection initialValue={buildSettings(' ')} onChange={onChange} />,
    );

    await user.selectOptions(screen.getByRole('combobox', { name: 'Разделитель' }), 'custom');
    await user.type(screen.getByLabelText('Свой символ'), '—');

    expect(onChange).toHaveBeenLastCalledWith(buildSettings('—'));
    expect(screen.getByLabelText('Свой символ')).toHaveValue('—');
  });

  it('keeps a preset character selected as a custom delimiter', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <ControlledPartyTrackDisplaySection initialValue={buildSettings(' ')} onChange={onChange} />,
    );

    await user.selectOptions(screen.getByRole('combobox', { name: 'Разделитель' }), 'custom');
    await user.type(screen.getByLabelText('Свой символ'), '-');

    expect(screen.getByRole('combobox', { name: 'Разделитель' })).toHaveValue('custom');
    expect(screen.getByLabelText('Свой символ')).toHaveValue('-');
  });

  it('switches from a custom character back to a preset', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <ControlledPartyTrackDisplaySection initialValue={buildSettings('|')} onChange={onChange} />,
    );

    await user.selectOptions(screen.getByRole('combobox', { name: 'Разделитель' }), 'hyphen');

    expect(onChange).toHaveBeenLastCalledWith(buildSettings('-'));
    expect(screen.queryByLabelText('Свой символ')).not.toBeInTheDocument();
  });

  it('keeps a custom value after the parent saves the change', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <ControlledPartyTrackDisplaySection initialValue={buildSettings(' ')} onChange={onChange} />,
    );

    await user.selectOptions(screen.getByRole('combobox', { name: 'Разделитель' }), 'custom');
    const customInput = screen.getByLabelText('Свой символ');
    await user.clear(customInput);
    await user.type(customInput, '.');

    expect(screen.getByRole('combobox', { name: 'Разделитель' })).toHaveValue('custom');
    expect(screen.getByLabelText('Свой символ')).toHaveValue('.');
  });

  it('supports directly selecting a preset', () => {
    const onChange = jest.fn();
    render(
      <ControlledPartyTrackDisplaySection initialValue={buildSettings(' ')} onChange={onChange} />,
    );

    fireEvent.change(screen.getByRole('combobox', { name: 'Разделитель' }), {
      target: { value: 'hyphen' },
    });

    expect(onChange).toHaveBeenLastCalledWith(buildSettings('-'));
  });

  it('keeps a custom option selected when an external update adds a preset character', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const { rerender } = render(
      <PartyTrackDisplaySection value={buildSettings(' ')} onChange={onChange} />,
    );

    rerender(<PartyTrackDisplaySection value={buildSettings('|')} onChange={onChange} />);
    const customInput = screen.getByLabelText('Свой символ');
    await user.clear(customInput);
    await user.type(customInput, '-');

    expect(onChange).toHaveBeenLastCalledWith(buildSettings('-'));
    expect(screen.getByRole('combobox', { name: 'Разделитель' })).toHaveValue('custom');
    expect(screen.getByLabelText('Свой символ')).toHaveValue('-');
  });
});

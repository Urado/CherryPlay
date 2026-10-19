// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdaptiveSearchInput } from './AdaptiveSearchInput';

describe('AdaptiveSearchInput', () => {
  const onValueChange = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    onValueChange.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('uses the short-search delay for one or two characters', () => {
    render(<AdaptiveSearchInput label="Поиск" value="" onValueChange={onValueChange} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Поиск' }), {
      target: { value: 'ab' },
    });

    void act(() => { vi.advanceTimersByTime(1499); });
    expect(onValueChange).not.toHaveBeenCalled();
    void act(() => { vi.advanceTimersByTime(1); });
    expect(onValueChange).toHaveBeenCalledWith('ab');
  });

  it('uses the long-search delay for three or more characters', () => {
    render(<AdaptiveSearchInput label="Поиск" value="" onValueChange={onValueChange} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Поиск' }), {
      target: { value: 'party' },
    });

    void act(() => { vi.advanceTimersByTime(349); });
    expect(onValueChange).not.toHaveBeenCalled();
    void act(() => { vi.advanceTimersByTime(1); });
    expect(onValueChange).toHaveBeenCalledWith('party');
  });

  it('cancels a pending short search when typing continues into a long search', () => {
    render(<AdaptiveSearchInput label="Поиск" value="" onValueChange={onValueChange} />);
    const input = screen.getByRole('textbox', { name: 'Поиск' });
    fireEvent.change(input, { target: { value: 'ab' } });
    void act(() => { vi.advanceTimersByTime(500); });
    fireEvent.change(input, { target: { value: 'abc' } });
    void act(() => { vi.advanceTimersByTime(349); });
    expect(onValueChange).not.toHaveBeenCalled();
    void act(() => { vi.advanceTimersByTime(1); });
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('abc');
  });

  it('clears immediately and cancels pending work', () => {
    render(<AdaptiveSearchInput label="Поиск" value="" onValueChange={onValueChange} />);
    const input = screen.getByRole('textbox', { name: 'Поиск' });
    fireEvent.change(input, { target: { value: 'query' } });
    fireEvent.change(input, { target: { value: '' } });

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('');
    void act(() => { vi.runOnlyPendingTimers(); });
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it('does not apply an incomplete IME composition', () => {
    render(<AdaptiveSearchInput label="Поиск" value="" onValueChange={onValueChange} />);
    const input = screen.getByRole('textbox', { name: 'Поиск' });
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: '東京音' } });
    void act(() => { vi.runOnlyPendingTimers(); });
    expect(onValueChange).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input, { data: '東京音' });
    void act(() => { vi.advanceTimersByTime(349); });
    expect(onValueChange).not.toHaveBeenCalled();
    void act(() => { vi.advanceTimersByTime(1); });
    expect(onValueChange).toHaveBeenCalledWith('東京音');
  });

  it('follows external URL state without issuing another search', () => {
    const view = render(
      <AdaptiveSearchInput label="Поиск" value="old" onValueChange={onValueChange} />,
    );
    view.rerender(<AdaptiveSearchInput label="Поиск" value="restored" onValueChange={onValueChange} />);

    expect((screen.getByRole('textbox', { name: 'Поиск' })).value).toBe(
      'restored',
    );
    void act(() => { vi.runOnlyPendingTimers(); });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('cancels pending search on unmount', () => {
    const view = render(<AdaptiveSearchInput label="Поиск" value="" onValueChange={onValueChange} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Поиск' }), {
      target: { value: 'query' },
    });
    view.unmount();
    void act(() => { vi.runOnlyPendingTimers(); });
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

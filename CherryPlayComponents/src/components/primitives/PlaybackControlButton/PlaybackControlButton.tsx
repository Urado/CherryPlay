import * as React from 'react';

import { cn } from '../../../utils/cn';
import { Icon, type IconSize } from '../Icon/Icon';

import { playbackControlGlyphs } from './playbackControlGlyphs';

import './PlaybackControlButton.css';

export type PlaybackControl = 'play' | 'pause' | 'stop' | 'next' | 'error';
export type PlaybackControlSize = 'sm' | 'md';

const DEFAULT_ARIA_LABELS: Record<PlaybackControl, string> = {
  play: 'Play',
  pause: 'Pause',
  stop: 'Stop',
  next: 'Next track',
  error: 'Playback error',
};

function isEmphasisControl(control: PlaybackControl): boolean {
  return control === 'play' || control === 'pause' || control === 'error';
}

function mapIconSize(size: PlaybackControlSize, emphasis: boolean): IconSize {
  if (size === 'sm') {
    return 'sm';
  }
  return emphasis ? 'lg' : 'md';
}

export interface PlaybackControlButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  control: PlaybackControl;
  size?: PlaybackControlSize;
}

export const PlaybackControlButton = React.forwardRef<
  HTMLButtonElement,
  PlaybackControlButtonProps
>(
  (
    {
      control,
      size = 'md',
      className,
      disabled,
      title,
      type,
      'aria-label': ariaLabelProp,
      ...props
    },
    ref,
  ) => {
    const emphasis = size === 'md' && isEmphasisControl(control);
    const iconSize = mapIconSize(size, emphasis);
    const ariaLabel = ariaLabelProp ?? title ?? DEFAULT_ARIA_LABELS[control];

    return (
      <button
        ref={ref}
        type={type ?? 'button'}
        className={cn(
          'cp-playback-control',
          `cp-playback-control--${size}`,
          emphasis && 'cp-playback-control--emphasis',
          control === 'error' && 'cp-playback-control--error',
          className,
        )}
        disabled={disabled}
        title={title}
        aria-label={ariaLabel}
        {...props}
      >
        <Icon size={iconSize}>{playbackControlGlyphs[control]}</Icon>
      </button>
    );
  },
);

PlaybackControlButton.displayName = 'PlaybackControlButton';

import * as React from 'react';

import { cn } from '../../../utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md';
/** Resting color tone for icon/border (orthogonal to filled `variant="danger"`). */
export type ButtonTone = 'neutral' | 'danger';
/** Background fill mode (orthogonal to `hoverable` border/color chrome). */
export type ButtonFill = 'none' | 'hover' | 'always';

export interface ButtonChromeProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  iconOnly?: boolean;
  /** When true, suppress border chrome (`cp-button--borderless`). Default false. */
  borderless?: boolean;
  /**
   * Resting icon/border color tone (`cp-button--tone-*`).
   * Use with `ghost`/`secondary` for tinted chrome; filled `variant="danger"` stays separate.
   */
  tone?: ButtonTone;
  /**
   * When false, hover keeps the same chrome as rest (`cp-button--no-hover`).
   * Default true.
   */
  hoverable?: boolean;
  /**
   * Background fill (`cp-button--fill-hover` / `cp-button--fill-always`).
   * Works with `tone="danger"` for red outline at rest + red fill on hover.
   * Default `none`.
   */
  filled?: ButtonFill;
}

export const BUTTON_CHROME_DEFAULTS: Required<ButtonChromeProps> = {
  variant: 'primary',
  size: 'md',
  fullWidth: false,
  iconOnly: false,
  borderless: false,
  tone: 'neutral',
  hoverable: true,
  filled: 'none',
};

export type ResolvedButtonChromeProps = Required<ButtonChromeProps>;

export function resolveChromeProps(props: ButtonChromeProps): ResolvedButtonChromeProps {
  return {
    variant: props.variant ?? BUTTON_CHROME_DEFAULTS.variant,
    size: props.size ?? BUTTON_CHROME_DEFAULTS.size,
    fullWidth: props.fullWidth ?? BUTTON_CHROME_DEFAULTS.fullWidth,
    iconOnly: props.iconOnly ?? BUTTON_CHROME_DEFAULTS.iconOnly,
    borderless: props.borderless ?? BUTTON_CHROME_DEFAULTS.borderless,
    tone: props.tone ?? BUTTON_CHROME_DEFAULTS.tone,
    hoverable: props.hoverable ?? BUTTON_CHROME_DEFAULTS.hoverable,
    filled: props.filled ?? BUTTON_CHROME_DEFAULTS.filled,
  };
}

export interface ButtonClassNameOptions extends ButtonChromeProps {
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

export function buttonClassNames({
  variant = BUTTON_CHROME_DEFAULTS.variant,
  size = BUTTON_CHROME_DEFAULTS.size,
  fullWidth = BUTTON_CHROME_DEFAULTS.fullWidth,
  iconOnly = BUTTON_CHROME_DEFAULTS.iconOnly,
  loading = false,
  disabled = false,
  borderless = BUTTON_CHROME_DEFAULTS.borderless,
  tone = BUTTON_CHROME_DEFAULTS.tone,
  hoverable = BUTTON_CHROME_DEFAULTS.hoverable,
  filled = BUTTON_CHROME_DEFAULTS.filled,
  className,
}: ButtonClassNameOptions): string {
  return cn(
    'cp-button',
    `cp-button--${variant}`,
    `cp-button--${size}`,
    fullWidth && 'cp-button--full-width',
    iconOnly && 'cp-button--icon-only',
    loading && 'cp-button--loading',
    disabled && 'cp-button--disabled',
    borderless && 'cp-button--borderless',
    tone !== 'neutral' && `cp-button--tone-${tone}`,
    !hoverable && 'cp-button--no-hover',
    filled === 'hover' && 'cp-button--fill-hover',
    filled === 'always' && 'cp-button--fill-always',
    className,
  );
}

export const ICON_ONLY_ACCESSIBLE_NAME_WARNING =
  'iconOnly button control should have aria-label or aria-labelledby for accessibility.';

export const BUTTON_LOADING_LABEL_DEFAULT = 'Загрузка...';

export function hasIconOnlyAccessibleName(ariaLabel?: string, ariaLabelledBy?: string): boolean {
  return Boolean(ariaLabel || ariaLabelledBy);
}

export function createDisabledLinkClickHandler(
  disabled: boolean,
  onClick?: React.MouseEventHandler<HTMLAnchorElement>,
): React.MouseEventHandler<HTMLAnchorElement> {
  return (event) => {
    if (disabled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    onClick?.(event);
  };
}

export function useIconOnlyA11yWarning(iconOnly: boolean, hasAccessibleName: boolean): void {
  const warnedAboutIconOnlyNameRef = React.useRef(false);

  React.useEffect(() => {
    const nodeEnv = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
      ?.NODE_ENV;
    const isDev = nodeEnv === 'development';

    if (isDev && iconOnly && !hasAccessibleName && !warnedAboutIconOnlyNameRef.current) {
      warnedAboutIconOnlyNameRef.current = true;
      console.warn(ICON_ONLY_ACCESSIBLE_NAME_WARNING);
    }
  }, [hasAccessibleName, iconOnly]);
}

export interface ButtonInnerContentProps {
  children?: React.ReactNode;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  iconOnly?: boolean;
  loading?: boolean;
  loadingLabel?: string;
}

function ButtonLoadingSpinner(): React.ReactElement {
  return (
    <span className="cp-button__icon cp-button__icon--loading" aria-hidden="true">
      <svg viewBox="0 0 16 16" width="16" height="16" focusable="false">
        <circle
          cx="8"
          cy="8"
          r="6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          opacity="0.3"
        />
        <path d="M8 2a6 6 0 0 1 6 6" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    </span>
  );
}

export function ButtonInnerContent({
  children,
  startIcon,
  endIcon,
  iconOnly = false,
  loading = false,
  loadingLabel = BUTTON_LOADING_LABEL_DEFAULT,
}: ButtonInnerContentProps): React.ReactElement {
  const iconOnlyFallback =
    iconOnly && startIcon == null && endIcon == null && children != null ? children : null;
  const resolvedStartIcon = startIcon ?? iconOnlyFallback;
  const showStartIcon = !loading && resolvedStartIcon != null;
  const showEndIcon = !loading && endIcon != null;
  const hideDecorativeIcons = !iconOnly;

  return (
    <>
      {iconOnly && loading && <ButtonLoadingSpinner />}
      {showStartIcon && (
        <span
          className="cp-button__icon cp-button__icon--start"
          aria-hidden={hideDecorativeIcons || undefined}
        >
          {resolvedStartIcon}
        </span>
      )}
      {!iconOnly && <span className="cp-button__label">{loading ? loadingLabel : children}</span>}
      {showEndIcon && (
        <span
          className="cp-button__icon cp-button__icon--end"
          aria-hidden={hideDecorativeIcons || undefined}
        >
          {endIcon}
        </span>
      )}
    </>
  );
}

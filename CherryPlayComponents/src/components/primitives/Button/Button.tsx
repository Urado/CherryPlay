import React from 'react';

import {
  type ButtonChromeProps,
  type ButtonFill,
  type ButtonSize,
  type ButtonTone,
  type ButtonVariant,
  BUTTON_LOADING_LABEL_DEFAULT,
  ButtonInnerContent,
  buttonClassNames,
  hasIconOnlyAccessibleName,
  resolveChromeProps,
  useIconOnlyA11yWarning,
} from './buttonShared';

import './Button.css';

export type { ButtonChromeProps, ButtonFill, ButtonSize, ButtonTone, ButtonVariant };

export interface ButtonProps
  extends ButtonChromeProps, React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingLabel?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant,
      size,
      fullWidth,
      iconOnly,
      borderless,
      tone,
      hoverable,
      filled,
      loading = false,
      loadingLabel = BUTTON_LOADING_LABEL_DEFAULT,
      startIcon,
      endIcon,
      children,
      className,
      disabled,
      type,
      ...rest
    },
    ref,
  ) => {
    const chrome = resolveChromeProps({
      variant,
      size,
      fullWidth,
      iconOnly,
      borderless,
      tone,
      hoverable,
      filled,
    });
    const isDisabled = disabled || loading;
    const hasAccessibleName = hasIconOnlyAccessibleName(
      rest['aria-label'],
      rest['aria-labelledby'],
    );

    useIconOnlyA11yWarning(chrome.iconOnly, hasAccessibleName);

    return (
      <button
        ref={ref}
        className={buttonClassNames({
          ...chrome,
          loading,
          className,
        })}
        {...rest}
        type={type ?? 'button'}
        disabled={isDisabled}
        aria-busy={loading || undefined}
      >
        <ButtonInnerContent
          iconOnly={chrome.iconOnly}
          loading={loading}
          loadingLabel={loadingLabel}
          startIcon={startIcon}
          endIcon={endIcon}
        >
          {children}
        </ButtonInnerContent>
      </button>
    );
  },
);

Button.displayName = 'Button';

import * as React from 'react';

import {
  type ButtonChromeProps,
  ButtonInnerContent,
  buttonClassNames,
  createDisabledLinkClickHandler,
  hasIconOnlyAccessibleName,
  resolveChromeProps,
  useIconOnlyA11yWarning,
} from './buttonShared';

export interface ButtonLinkProps
  extends ButtonChromeProps, Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'type'> {
  disabled?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

export const ButtonLink = React.forwardRef<HTMLAnchorElement, ButtonLinkProps>(
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
      disabled = false,
      startIcon,
      endIcon,
      className,
      children,
      onClick,
      tabIndex,
      title,
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
    const hasAccessibleName = hasIconOnlyAccessibleName(
      rest['aria-label'],
      rest['aria-labelledby'],
    );

    useIconOnlyA11yWarning(chrome.iconOnly, hasAccessibleName);

    const handleClick = createDisabledLinkClickHandler(disabled, onClick);

    return (
      <a
        ref={ref}
        className={buttonClassNames({
          ...chrome,
          disabled,
          className,
        })}
        title={title}
        onClick={handleClick}
        {...rest}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : tabIndex}
      >
        <ButtonInnerContent iconOnly={chrome.iconOnly} startIcon={startIcon} endIcon={endIcon}>
          {children}
        </ButtonInnerContent>
      </a>
    );
  },
);

ButtonLink.displayName = 'ButtonLink';

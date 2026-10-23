import {
  useEffect,
  useRef,
  useState,
  type CompositionEvent,
  type InputHTMLAttributes,
} from 'react';

import { FormInput } from './FormInput';

export const SEARCH_DEBOUNCE_THRESHOLD = 3;
export const SEARCH_DEBOUNCE_LONG_MS = 350;
export const SEARCH_DEBOUNCE_SHORT_MS = 1500;

export interface AdaptiveSearchInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'value'
> {
  label: string;
  hint?: string;
  value: string;
  onValueChange: (value: string) => void;
}

export const AdaptiveSearchInput = ({
  label,
  hint,
  value,
  onValueChange,
  onCompositionStart,
  onCompositionEnd,
  ...inputProps
}: AdaptiveSearchInputProps) => {
  const [inputValue, setInputValue] = useState(value);
  const [composing, setComposing] = useState(false);
  const onValueChangeRef = useRef(onValueChange);
  const skipScheduledValueRef = useRef(false);
  const previousValueRef = useRef(value);

  useEffect(() => {
    onValueChangeRef.current = onValueChange;
  }, [onValueChange]);

  useEffect(() => {
    if (previousValueRef.current === value) return;
    previousValueRef.current = value;
    skipScheduledValueRef.current = true;
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    if (skipScheduledValueRef.current) {
      skipScheduledValueRef.current = false;
      return;
    }
    if (composing || inputValue === value) return;

    const normalizedValue = inputValue.trim();
    if (!normalizedValue) return;

    const delay =
      normalizedValue.length >= SEARCH_DEBOUNCE_THRESHOLD
        ? SEARCH_DEBOUNCE_LONG_MS
        : SEARCH_DEBOUNCE_SHORT_MS;
    const timer = window.setTimeout(() => onValueChangeRef.current(normalizedValue), delay);
    return () => window.clearTimeout(timer);
  }, [composing, inputValue, value]);

  const handleCompositionStart = (event: CompositionEvent<HTMLInputElement>) => {
    setComposing(true);
    onCompositionStart?.(event);
  };

  const handleCompositionEnd = (event: CompositionEvent<HTMLInputElement>) => {
    setComposing(false);
    setInputValue(event.currentTarget.value);
    if (!event.currentTarget.value.trim()) onValueChangeRef.current('');
    onCompositionEnd?.(event);
  };

  const handleChange = (nextValue: string) => {
    setInputValue(nextValue);
    if (!nextValue.trim() && !composing) onValueChangeRef.current('');
  };

  return (
    <FormInput
      {...inputProps}
      label={label}
      hint={hint}
      value={inputValue}
      onChange={(event) => handleChange(event.target.value)}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
    />
  );
};

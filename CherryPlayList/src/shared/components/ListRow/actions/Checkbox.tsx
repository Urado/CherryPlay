import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import React from 'react';

import { useListRowContext } from '../ListRowContext';

/**
 * Props for Checkbox component
 */
export interface CheckboxProps {
  /** Called when checkbox is toggled */
  onToggle?: (e: React.MouseEvent) => void;
}

/**
 * Checkbox - Selection checkbox for items
 *
 * Displays checked/unchecked state based on context.
 */
export const Checkbox: React.FC<CheckboxProps> = ({ onToggle }) => {
  const { baseClassName, isSelected } = useListRowContext();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle?.(e);
  };

  return (
    <button
      type="button"
      className={`${baseClassName}-checkbox ${isSelected ? 'checked' : ''}`}
      onClick={handleClick}
      aria-pressed={isSelected}
      aria-label={isSelected ? 'Deselect item' : 'Select item'}
    >
      {isSelected ? (
        <CheckBoxIcon className="checkbox-icon" />
      ) : (
        <CheckBoxOutlineBlankIcon className="checkbox-icon" />
      )}
    </button>
  );
};

Checkbox.displayName = 'ListRow.Checkbox';

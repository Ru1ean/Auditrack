import React, { forwardRef, useId } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Styled select dropdown component
 * @param {Object} props
 * @param {string} [props.label]
 * @param {string} [props.error]
 * @param {string} [props.helper]
 * @param {boolean} [props.required]
 * @param {string} [props.id]
 * @param {string} [props.className]
 * @param {React.ReactNode} props.children
 */
const Select = forwardRef(({
  label,
  error,
  helper,
  required,
  id,
  className = '',
  children,
  ...rest
}, ref) => {
  const generatedId = useId();
  const selectId = id || generatedId;

  return (
    <div className={`w-full flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-text-primary">
          {label}
          {required && <span className="text-danger-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          required={required}
          className={`input-base appearance-none w-full pr-10 ${error ? 'input-error border-danger-500 focus:ring-danger-500' : ''}`}
          {...rest}
        >
          {children}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-500">
          <ChevronDown size={16} />
        </div>
      </div>
      {error ? (
        <p className="text-sm text-danger-500">{error}</p>
      ) : helper ? (
        <p className="text-sm text-gray-500">{helper}</p>
      ) : null}
    </div>
  );
});

Select.displayname = 'Select';

export default Select;

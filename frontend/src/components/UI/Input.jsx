import React, { forwardRef, useId } from 'react';

/**
 * Form input with integrated label and error
 * @param {Object} props
 * @param {string} [props.label]
 * @param {string} [props.error]
 * @param {string} [props.helper]
 * @param {boolean} [props.required]
 * @param {string} [props.id]
 * @param {string} [props.className]
 */
const Input = forwardRef(({
  label,
  error,
  helper,
  required,
  id,
  className = '',
  ...rest
}, ref) => {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <div className={`w-full flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-text-primary">
          {label}
          {required && <span className="text-danger-500 ml-1">*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        required={required}
        className={`input-base ${error ? 'input-error border-danger-500 focus:ring-danger-500' : ''}`}
        {...rest}
      />
      {error ? (
        <p className="text-sm text-danger-500">{error}</p>
      ) : helper ? (
        <p className="text-sm text-gray-500">{helper}</p>
      ) : null}
    </div>
  );
});

Input.displayname = 'Input';

export default Input;

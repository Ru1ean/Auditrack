import React, { forwardRef } from 'react';

/**
 * Standardized button component
 * @param {Object} props
 * @param {'primary'|'secondary'|'danger'|'ghost'|'save'} [props.variant='primary']
 * @param {'sm'|'md'|'lg'} [props.size='md']
 * @param {boolean} [props.loading=false]
 * @param {React.ReactNode} [props.icon]
 * @param {React.ReactNode} [props.iconRight]
 * @param {string} [props.className]
 */
const Button = forwardRef(({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconRight,
  children,
  className = '',
  disabled,
  ...rest
}, ref) => {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2 text-sm',
    lg: 'px-6 py-2.5 text-base',
  };

  const baseClasses = `btn btn-${variant} ${sizeClasses[size] || sizeClasses.md} focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 inline-flex items-center justify-center gap-2 ${className}`;

  return (
    <button
      ref={ref}
      className={baseClasses}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {!loading && icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
      {!loading && iconRight && <span className="flex-shrink-0">{iconRight}</span>}
    </button>
  );
});

Button.displayname = 'Button';

export default Button;

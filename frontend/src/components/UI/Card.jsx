import React, { forwardRef } from 'react';

/**
 * Card container component
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.className]
 * @param {'none'|'sm'|'md'|'lg'} [props.padding='md']
 * @param {boolean} [props.hover=true]
 * @param {string} [props.accentColor]
 */
const Card = forwardRef(({
  children,
  className = '',
  padding = 'md',
  hover = true,
  accentColor,
  ...rest
}, ref) => {
  const paddingClasses = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const style = accentColor ? { borderLeftColor: accentColor } : {};
  const accentClass = accentColor ? 'border-l-4' : '';
  
  return (
    <div
      ref={ref}
      style={style}
      className={`card bg-app-surface rounded-xl border border-app-border ${hover ? 'app-card-hover' : ''} ${paddingClasses[padding] || paddingClasses.md} ${accentClass} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
});

Card.displayname = 'Card';

export default Card;

import React from 'react';

/**
 * Status badge component
 * @param {Object} props
 * @param {'success'|'warning'|'danger'|'info'|'neutral'|'purple'} [props.variant='neutral']
 * @param {React.ReactNode} [props.icon]
 * @param {string} [props.className]
 * @param {React.ReactNode} props.children
 */
const Badge = ({ variant = 'neutral', children, icon, className = '' }) => {
  return (
    <span className={`badge badge-${variant} inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </span>
  );
};

export default Badge;

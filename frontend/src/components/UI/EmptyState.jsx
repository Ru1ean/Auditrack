import React from 'react';

/**
 * EmptyState component for displaying when data lists are empty.
 * 
 * @param {Object} props
 * @param {React.ElementType} [props.icon] - Lucide React icon component
 * @param {string} props.title - Title text
 * @param {string} [props.description] - Description text
 * @param {React.ReactNode} [props.action] - Action button or element
 * @param {string} [props.className] - Additional CSS classes
 */
export default function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
      {Icon && (
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[var(--brand-500,#3b82f6)] bg-opacity-10 mb-4">
          <Icon className="w-8 h-8 text-[var(--brand-600,#2563eb)]" strokeWidth={1.5} />
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-700 mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-500 max-w-sm mb-6">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}

import React from 'react';

/**
 * SkeletonLine - A simple line skeleton
 * 
 * @param {Object} props
 * @param {string} [props.width='100%'] - Width of the line
 * @param {string} [props.height='1rem'] - Height of the line
 * @param {string} [props.className] - Additional CSS classes
 */
export function SkeletonLine({ width = '100%', height = '1rem', className = '' }) {
  return (
    <div 
      className={`skeleton rounded-md ${className}`} 
      style={{ width, height, backgroundColor: 'var(--app-border, #e2e8f0)' }}
    />
  );
}

/**
 * SkeletonCard - A card-shaped skeleton with 3 lines
 * 
 * @param {Object} props
 * @param {string} [props.className] - Additional CSS classes
 */
export function SkeletonCard({ className = '' }) {
  return (
    <div className={`p-4 border border-[var(--app-border, #e2e8f0)] rounded-lg bg-[var(--app-surface, #ffffff)] ${className}`}>
      <SkeletonLine width="60%" height="1.25rem" className="mb-4" />
      <SkeletonLine width="100%" height="1rem" className="mb-2" />
      <SkeletonLine width="80%" height="1rem" />
    </div>
  );
}

/**
 * SkeletonTable - A table skeleton
 * 
 * @param {Object} props
 * @param {number} [props.rows=5] - Number of rows
 * @param {number} [props.columns=4] - Number of columns
 * @param {string} [props.className] - Additional CSS classes
 */
export function SkeletonTable({ rows = 5, columns = 4, className = '' }) {
  return (
    <div className={`w-full border border-[var(--app-border, #e2e8f0)] rounded-lg overflow-hidden bg-[var(--app-surface, #ffffff)] ${className}`}>
      <div className="flex border-b border-[var(--app-border, #e2e8f0)] bg-gray-50 p-4 gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <SkeletonLine key={`th-${i}`} height="1.25rem" className="flex-1" />
        ))}
      </div>
      <div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={`tr-${r}`} className="flex border-b border-[var(--app-border, #e2e8f0)] last:border-0 p-4 gap-4">
            {Array.from({ length: columns }).map((_, c) => (
              <SkeletonLine key={`td-${r}-${c}`} height="1rem" className="flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * SkeletonAvatar - A circular skeleton
 * 
 * @param {Object} props
 * @param {string} [props.size='2.5rem'] - Size of the avatar
 * @param {string} [props.className] - Additional CSS classes
 */
export function SkeletonAvatar({ size = '2.5rem', className = '' }) {
  return (
    <div 
      className={`skeleton rounded-full ${className}`} 
      style={{ width: size, height: size, backgroundColor: 'var(--app-border, #e2e8f0)' }}
    />
  );
}

export default SkeletonLine;

import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/**
 * Breadcrumbs navigation component.
 * 
 * @param {Object} props
 * @param {Array<{label: string, href?: string}>} props.items - Breadcrumb items
 * @param {string} [props.className] - Additional CSS classes
 */
export default function Breadcrumbs({ items = [], className = '' }) {
  if (!items || items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex items-center space-x-1 sm:space-x-2 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          
          return (
            <li key={index} className="flex items-center">
              {isLast ? (
                <span className="font-semibold text-gray-900" aria-current="page">
                  {item.label}
                </span>
              ) : (
                <>
                  <Link 
                    to={item.href || '#'} 
                    className="text-gray-500 hover:text-gray-900 hover:underline transition-colors"
                  >
                    {item.label}
                  </Link>
                  <ChevronRight className="w-4 h-4 text-gray-400 mx-1 sm:mx-2 flex-shrink-0" />
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

import React from 'react';
import { Link } from 'react-router-dom';

/**
 * NotFound component for 404 pages.
 */
export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-9xl font-bold text-[var(--brand-500,#3b82f6)] opacity-20 mb-4 select-none">
        404
      </h1>
      <h2 className="text-3xl font-bold text-[var(--text-primary,#1e293b)] mb-2">Page Not Found</h2>
      <p className="text-gray-500 max-w-md mb-8">
        The page you are looking for doesn't exist or has been moved.
      </p>
      <Link 
        to="/home" 
        className="px-6 py-2 bg-[var(--brand-600,#2563eb)] text-white font-medium rounded-md hover:bg-[var(--brand-700,#1d4ed8)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--brand-500,#3b82f6)] transition-colors"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}

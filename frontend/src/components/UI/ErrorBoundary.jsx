import React, { Component } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Error Boundary component to catch React rendering errors.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleTryAgain = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center p-6 text-center h-full">
          <div className="w-16 h-16 bg-[var(--danger-500,#ef4444)] bg-opacity-10 rounded-full flex items-center justify-center mb-6">
            <AlertTriangle className="w-8 h-8 text-[var(--danger-600,#dc2626)]" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-gray-600 max-w-md mb-6">
            We encountered an unexpected error while trying to render this component.
          </p>
          
          {this.state.error && (
            <div className="bg-gray-100 p-4 rounded-md text-left text-sm text-[var(--danger-600,#dc2626)] font-mono mb-8 max-w-2xl w-full overflow-auto">
              {this.state.error.toString()}
            </div>
          )}

          <div className="flex gap-4">
            <button 
              onClick={this.handleTryAgain}
              className="px-4 py-2 bg-[var(--brand-600,#2563eb)] text-white rounded-md hover:bg-[var(--brand-700,#1d4ed8)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--brand-500,#3b82f6)] transition-colors"
            >
              Try again
            </button>
            <Link 
              to="/home" 
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-colors"
              onClick={() => this.setState({ hasError: false })}
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

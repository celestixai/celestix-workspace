import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="text-accent-amber mb-4">
            <AlertTriangle size={48} />
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-1">Something went wrong</h3>
          <p className="text-sm text-text-secondary max-w-md mb-4">
            An unexpected error occurred. Please try again.
          </p>
          {this.state.error && (
            <p className="text-xs text-text-tertiary font-mono max-w-md mb-4 truncate">
              {this.state.error.message}
            </p>
          )}
          <Button variant="secondary" size="sm" onClick={this.handleRetry}>
            <RotateCcw size={14} />
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

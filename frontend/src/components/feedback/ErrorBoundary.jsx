import React from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';
import { Button } from '../common/Button';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled React Rendering Error caught by ErrorBoundary:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-defense-950 flex items-center justify-center p-6 text-slate-100">
          <div className="max-w-md w-full glass-panel border border-rose-500/40 p-8 rounded-2xl text-center space-y-5 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-rose-950/60 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-100">Interface Component Fault</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              A UI rendering boundary exception occurred. The system state has been quarantined to prevent data corruption.
            </p>
            <Button variant="primary" icon={RefreshCw} onClick={this.handleReset} className="w-full">
              Reload Secure Session
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

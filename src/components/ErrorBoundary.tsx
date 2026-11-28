import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { ErrorOutlined } from '@mui/icons-material';
import { createLogger } from '@/services/logger';
import { defaultScheme as scheme, typography } from '@/theme/tokens';

const log = createLogger('ErrorBoundary');

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Called once per caught error, after it is logged (e.g. to save timer progress). */
  onError?: (error: Error) => void;
  /** Offer "Try again", which re-renders the children. Off when retrying cannot help. */
  allowRetry?: boolean;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render errors below it, logs them, and shows a recovery screen
 * instead of a blank window.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    log.error('Render error:', error, info.componentStack ?? '');
    try {
      this.props.onError?.(error);
    } catch (handlerError) {
      log.error('Error handler failed:', handlerError);
    }
  }

  private retry = () => this.setState({ error: null });

  private reload = () => window.location.reload();

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <CrashScreen
        error={error}
        onRetry={this.props.allowRetry === false ? undefined : this.retry}
        onReload={this.reload}
      />
    );
  }
}

interface CrashScreenProps {
  error: Error;
  onRetry?: () => void;
  onReload: () => void;
}

function CrashScreen({ error, onRetry, onReload }: CrashScreenProps) {
  return (
    <Box
      role="alert"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        p: 4,
        textAlign: 'center',
        bgcolor: scheme.surface.page,
        color: scheme.text.primary,
      }}
    >
      <ErrorOutlined sx={{ fontSize: 56, color: scheme.error }} />
      <Typography variant="h5" component="h1" sx={{ fontWeight: 500 }}>
        Something went wrong
      </Typography>
      <Typography variant="body2" sx={{ maxWidth: 440, color: scheme.text.secondary }}>
        This view hit an unexpected error. Your focus session is kept: its progress is saved and a
        running timer keeps going. The details are in the app log.
      </Typography>
      <Typography
        variant="caption"
        component="code"
        sx={{ maxWidth: 520, color: scheme.text.muted, fontFamily: typography.monoFamily }}
      >
        {error.message}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1.5, mt: 1 }}>
        {onRetry && (
          <Button variant="contained" onClick={onRetry}>
            Try again
          </Button>
        )}
        <Button variant={onRetry ? 'outlined' : 'contained'} onClick={onReload}>
          Reload app
        </Button>
      </Box>
    </Box>
  );
}

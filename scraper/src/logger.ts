/**
 * Unified logging system that sends messages to WebSocket clients
 */

export type LogLevel = 'info' | 'success' | 'warning' | 'error';

export interface LogMessage {
  timestamp: string;
  level: LogLevel;
  phase: string;
  message: string;
}

export type LogCallback = (log: LogMessage) => void;

class Logger {
  private callback: LogCallback | null = null;
  private currentPhase: string = '';

  setCallback(callback: LogCallback) {
    this.callback = callback;
  }

  clearCallback() {
    this.callback = null;
  }

  setPhase(phase: string) {
    this.currentPhase = phase;
  }

  private log(level: LogLevel, message: string) {
    const logMessage: LogMessage = {
      timestamp: new Date().toISOString(),
      level,
      phase: this.currentPhase,
      message
    };

    // Always console.log for server-side debugging
    const prefix = level === 'error' ? '❌' : level === 'warning' ? '⚠️' : level === 'success' ? '✅' : 'ℹ️';
    console.log(`${prefix} [${this.currentPhase}] ${message}`);

    // Send to UI if callback is set
    if (this.callback) {
      this.callback(logMessage);
    }
  }

  info(message: string) {
    this.log('info', message);
  }

  success(message: string) {
    this.log('success', message);
  }

  warning(message: string) {
    this.log('warning', message);
  }

  error(message: string) {
    this.log('error', message);
  }
}

// Global logger instance
export const logger = new Logger();

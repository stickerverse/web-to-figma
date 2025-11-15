/**
 * Unified logging system that sends messages to WebSocket clients
 */
class Logger {
    callback = null;
    currentPhase = '';
    setCallback(callback) {
        this.callback = callback;
    }
    clearCallback() {
        this.callback = null;
    }
    setPhase(phase) {
        this.currentPhase = phase;
    }
    log(level, message) {
        const logMessage = {
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
    info(message) {
        this.log('info', message);
    }
    success(message) {
        this.log('success', message);
    }
    warning(message) {
        this.log('warning', message);
    }
    error(message) {
        this.log('error', message);
    }
}
// Global logger instance
export const logger = new Logger();
//# sourceMappingURL=logger.js.map
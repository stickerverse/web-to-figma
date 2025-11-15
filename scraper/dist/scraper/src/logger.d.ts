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
declare class Logger {
    private callback;
    private currentPhase;
    setCallback(callback: LogCallback): void;
    clearCallback(): void;
    setPhase(phase: string): void;
    private log;
    info(message: string): void;
    success(message: string): void;
    warning(message: string): void;
    error(message: string): void;
}
export declare const logger: Logger;
export {};
//# sourceMappingURL=logger.d.ts.map
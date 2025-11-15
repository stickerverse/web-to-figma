/**
 * Progress Tracking System with Circular Progress Bar
 */
export interface ProgressUpdate {
    phase: string;
    stage: string;
    current: number;
    total: number;
    percentage: number;
    message: string;
    timeElapsed: number;
    timeRemaining?: number;
}
export type ProgressCallback = (update: ProgressUpdate) => void;
export declare class ProgressTracker {
    private startTime;
    private currentPhase;
    private currentStage;
    private totalPhases;
    private completedPhases;
    private onProgress?;
    constructor(onProgress?: ProgressCallback);
    setTotalPhases(total: number): void;
    startPhase(phase: string, message?: string): void;
    updateStage(stage: string, current: number, total: number, message?: string): void;
    completePhase(): void;
    private reportProgress;
}
export declare class CircularProgressBar {
    private static readonly CIRCLE_CHARS;
    private static animationIndex;
    static render(percentage: number, phase: string, message: string, timeElapsed: number): string;
    static renderDetailed(update: ProgressUpdate): string;
}
export declare class ConsoleProgress {
    private lastLineLength;
    update(update: ProgressUpdate): void;
    complete(message?: string): void;
    newLine(): void;
}
//# sourceMappingURL=progress-tracker.d.ts.map
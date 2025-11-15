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

export class ProgressTracker {
  private startTime: number;
  private currentPhase: string = '';
  private currentStage: string = '';
  private totalPhases: number = 0;
  private completedPhases: number = 0;
  private onProgress?: ProgressCallback;

  constructor(onProgress?: ProgressCallback) {
    this.startTime = Date.now();
    this.onProgress = onProgress;
  }

  setTotalPhases(total: number) {
    this.totalPhases = total;
  }

  startPhase(phase: string, message: string = '') {
    this.currentPhase = phase;
    this.currentStage = 'starting';
    this.reportProgress(0, 1, message);
  }

  updateStage(stage: string, current: number, total: number, message: string = '') {
    this.currentStage = stage;
    this.reportProgress(current, total, message);
  }

  completePhase() {
    this.completedPhases++;
    this.reportProgress(1, 1, 'Phase completed');
  }

  private reportProgress(current: number, total: number, message: string) {
    const percentage = total > 0 ? Math.min((current / total) * 100, 100) : 0;
    const timeElapsed = Date.now() - this.startTime;
    
    // Estimate time remaining based on phase completion
    const phaseProgress = this.totalPhases > 0 ? 
      ((this.completedPhases + (current / total)) / this.totalPhases) : 0;
    
    const timeRemaining = phaseProgress > 0 ? 
      (timeElapsed / phaseProgress) - timeElapsed : undefined;

    const update: ProgressUpdate = {
      phase: this.currentPhase,
      stage: this.currentStage,
      current,
      total,
      percentage,
      message,
      timeElapsed,
      timeRemaining
    };

    if (this.onProgress) {
      this.onProgress(update);
    }
  }
}

export class CircularProgressBar {
  private static readonly CIRCLE_CHARS = ['◐', '◓', '◑', '◒'];
  private static animationIndex = 0;
  
  static render(percentage: number, phase: string, message: string, timeElapsed: number): string {
    // Animated spinner for ongoing progress
    const spinner = percentage < 100 ? 
      this.CIRCLE_CHARS[this.animationIndex++ % this.CIRCLE_CHARS.length] : 
      '✓';

    // Progress bar using block characters
    const barLength = 20;
    const filled = Math.round((percentage / 100) * barLength);
    const empty = barLength - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);

    // Time formatting
    const formatTime = (ms: number) => {
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
    };

    return `${spinner} ${phase} │ ${bar} │ ${percentage.toFixed(1)}% │ ${formatTime(timeElapsed)} │ ${message}`;
  }

  static renderDetailed(update: ProgressUpdate): string {
    const { phase, stage, percentage, timeElapsed, timeRemaining, message } = update;
    
    const formatTime = (ms: number) => {
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
    };

    const timeStr = timeRemaining ? 
      ` │ ${formatTime(timeElapsed)} / ~${formatTime(timeRemaining)}` : 
      ` │ ${formatTime(timeElapsed)}`;

    return this.render(percentage, `${phase} - ${stage}`, message, timeElapsed) + timeStr;
  }
}

// Console progress updater that overwrites the same line
export class ConsoleProgress {
  private lastLineLength = 0;

  update(update: ProgressUpdate) {
    // Clear the previous line
    if (this.lastLineLength > 0) {
      process.stdout.write('\r' + ' '.repeat(this.lastLineLength) + '\r');
    }

    const line = CircularProgressBar.renderDetailed(update);
    process.stdout.write(line);
    this.lastLineLength = line.length;
  }

  complete(message: string = 'Completed') {
    if (this.lastLineLength > 0) {
      process.stdout.write('\r' + ' '.repeat(this.lastLineLength) + '\r');
    }
    console.log(`✓ ${message}`);
    this.lastLineLength = 0;
  }

  newLine() {
    if (this.lastLineLength > 0) {
      process.stdout.write('\n');
      this.lastLineLength = 0;
    }
  }
}
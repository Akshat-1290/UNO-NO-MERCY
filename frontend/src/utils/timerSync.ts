/**
 * High-performance event bus for real-time turn countdown ticks.
 * Decouples 1-second WebSocket TIMER_TICK events from top-level React state,
 * preventing cascading virtual DOM reconciliations on idle turns.
 */

type TimerTickListener = (seconds: number, turnIndex: number) => void;

class TimerSyncBus {
  private listeners: Set<TimerTickListener> = new Set();
  private currentSeconds = 30;
  private currentTurnIndex = 0;

  public subscribe(listener: TimerTickListener): () => void {
    this.listeners.add(listener);
    // Initial immediate notification
    listener(this.currentSeconds, this.currentTurnIndex);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public emit(seconds: number, turnIndex: number): void {
    this.currentSeconds = seconds;
    this.currentTurnIndex = turnIndex;
    this.listeners.forEach((listener) => {
      try {
        listener(seconds, turnIndex);
      } catch (err) {
        console.error('Error in timer listener:', err);
      }
    });
  }

  public getSeconds(): number {
    return this.currentSeconds;
  }

  public getTurnIndex(): number {
    return this.currentTurnIndex;
  }
}

export const timerSync = new TimerSyncBus();

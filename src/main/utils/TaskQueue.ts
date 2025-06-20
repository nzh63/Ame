enum Result {
  Finished,
  Canceled,
}

export class TaskQueue {
  private running?: Promise<Result>;
  private abort?: () => void;

  public async dispatch<T>(task: (() => Promise<T>) | (() => T)): Promise<T> {
    const lock = await this.acquire();
    try {
      return await task();
    } finally {
      lock.release();
    }
  }

  public async acquire(): Promise<Readonly<Lock>> {
    this.abort?.();
    this.abort = undefined;

    const waiting = new Promise<Result>((resolve) => {
      this.abort = () => resolve(Result.Canceled);
    });

    const result = await Promise.any([this.running ?? Promise.resolve(Result.Finished), waiting]);

    if (result === Result.Canceled) {
      throw new Error('Canceled');
    }

    // @ts-expect-error microsoft/TypeScript#9998
    this.abort?.();
    this.abort = undefined;

    let task!: Lock;
    this.running = new Promise<Result>((resolve) => {
      task = {
        release: () => {
          this.running = undefined;
          task.release = () => {};
          resolve(Result.Finished);
        },
        [Symbol.dispose]() {
          task.release();
        },
      };
    });
    return task;
  }
}

interface Lock {
  release: () => void;
  [Symbol.dispose]: () => void;
}

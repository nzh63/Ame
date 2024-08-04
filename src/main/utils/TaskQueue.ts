export class TaskQueue {
    private abort?: (err: Error) => void;

    public async dispatch<T>(task: (() => Promise<T>) | (() => T)): Promise<T> {
        const lock = await this.acquire();
        try {
            return await task();
        } finally {
            lock.release();
        }
    }

    public async acquire(): Promise<Lock> {
        if (this.abort) {
            this.abort(new Error('acquire new task'));
        }
        let task: Lock;
        // eslint-disable-next-line no-new
        new Promise<void>((resolve, reject) => {
            this.abort = reject;
            task = {
                release: () => {
                    this.abort = undefined;
                    resolve();
                }
            };
        });
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return task!;
    }
}

interface Lock {
    release(): void;
}

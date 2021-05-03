export class TaskQueue {
    private promise = Promise.resolve();
    public dispatch<T>(task: (() => Promise<T>) | (() => T)): Promise<T> {
        const ret = this.promise.then(() => task());
        this.promise = ret.catch(() => undefined).then(() => undefined);
        return ret;
    }
}

export type Ret<T> = { err: any } | { value: T };

export function handleError<T>(ret: Ret<T>): T;
export function handleError<T>(ret: Promise<Ret<T>>): Promise<T>;
export function handleError<T>(ret: Ret<T> | Promise<Ret<T>>): T | Promise<T> {
    if (ret instanceof Promise) {
        return ret.then(r => {
            if ((r as { err: any }).err) { throw (r as { err: any }).err; } else return (r as { value: T }).value;
        });
    } else {
        if ((ret as { err: any }).err !== undefined) {
            throw (ret as { err: any }).err;
        } else {
            return (ret as { value: T }).value;
        }
    }
}

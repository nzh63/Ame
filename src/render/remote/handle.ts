export type Ret<T> = { err: any } | { value: T };

export function handleError<T>(ret: Ret<T>): T;
export function handleError<T>(ret: Promise<Ret<T>>): Promise<T>;
export function handleError<T>(ret: Ret<T> | Promise<Ret<T>>): T | Promise<T> {
    if (ret instanceof Promise) {
        return ret.then(r => {
            if ('err' in r) { throw r.err; } else return r.value;
        });
    } else {
        if ('err' in ret) {
            throw ret.err;
        } else {
            return ret.value;
        }
    }
}

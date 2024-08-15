type Ret<T> = Ame.IpcResult<T>;
type Await<T> = T extends Promise<infer R> ? R : T;

export function handleError<
    T extends (...args: any[]) => any,
    >(fun: T): (
        (...args: Parameters<T>)
            => ReturnType<T> extends Promise<any>
            ? Promise<Ret<Await<ReturnType<T>>>>
            : Ret<ReturnType<T>>);

export function handleError<
    T extends(...args: any[]) => any,
    >(fun: T) {
    return function(...args: Parameters<T>)
        : Promise<Ret<Await<ReturnType<T>>>>
        | Ret<ReturnType<T>> {
        try {
            const ret = fun(...args);
            if (ret instanceof Promise) {
                return new Promise<Ret<Await<ReturnType<T>>>>((resolve) => {
                    ret.then((value: Await<ReturnType<T>>) => {
                        resolve({ value });
                    }).catch((err: any) => {
                        resolve({ err });
                    });
                });
            } else {
                return { value: ret };
            }
        } catch (err) {
            return { err };
        }
    };
}

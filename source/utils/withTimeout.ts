// utils/withTimeout.ts
// Corta una promesa si tarda mas de `ms`. `ms` no finito o <= 0 la deja
// pasar sin envolverla (timeout deshabilitado).

export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
    if (!Number.isFinite(ms) || ms <= 0) return promise

    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(message)), ms)
        promise.then(
            (value) => {
                clearTimeout(timer)
                resolve(value)
            },
            (error) => {
                clearTimeout(timer)
                reject(error)
            },
        )
    })
}
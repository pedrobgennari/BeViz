export function assertNotNull<T>(value: T, errorMessage?: string): asserts value is NonNullable<T> {
    if (value === undefined || value === null) {
        throw new Error(errorMessage ?? `Assertion failed: value is '${value}'`);
    }
}

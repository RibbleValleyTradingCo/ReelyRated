export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isNumber(value: unknown): value is number {
  return typeof value === "number" && !Number.isNaN(value);
}

export function isArray<T = unknown>(value: unknown): value is T[] {
  return Array.isArray(value);
}

export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function assertDefined<T>(value: T | null | undefined, message = "Value cannot be null"):
  asserts value is T {
  if (!isDefined(value)) {
    throw new Error(message);
  }
}

export function hasProperty<T extends object, K extends PropertyKey>(obj: T, key: K): obj is T & Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

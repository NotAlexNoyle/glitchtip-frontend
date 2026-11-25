import { Signal, linkedSignal } from "@angular/core";

/**
 * Keeps the previously emitted value while `source` is momentarily undefined,
 * e.g. a resource reloading, so a list keeps its rows during a reload.
 */
export function keepPreviousValue<T>(
  source: () => T | undefined,
): Signal<T | undefined> {
  // A resource in the error state throws from .value(), and callers pass that
  // read in as `source`. Unguarded, the throw escapes change detection and
  // abandons the render pass, freezing the view with its spinner still up.
  // Treat it as "no new value"; the error surfaces via the error signal.
  const safeSource = () => {
    try {
      return source();
    } catch {
      return undefined;
    }
  };
  // Explicit generics avoid a circular inference on `previous.value`.
  return linkedSignal<T | undefined, T | undefined>({
    source: safeSource,
    computation: (value, previous) => value ?? previous?.value,
  }).asReadonly();
}

export interface OpenKeys extends Signal<ReadonlySet<string>> {
  toggle(key: string): void;
}

/** Which expandable rows are open; starts from `initial` again when `source` changes. */
export function openKeys<S>(
  source: () => S,
  initial: (value: S) => Iterable<string> = () => [],
): OpenKeys {
  const keys = linkedSignal<S, ReadonlySet<string>>({
    source,
    computation: (value) => new Set(initial(value)),
  });
  return Object.assign(keys.asReadonly(), {
    toggle(key: string) {
      keys.update((open) => {
        const next = new Set(open);
        if (!next.delete(key)) next.add(key);
        return next;
      });
    },
  });
}

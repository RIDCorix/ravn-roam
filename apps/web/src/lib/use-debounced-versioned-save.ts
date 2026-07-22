"use client";

import { useEffect, useRef } from "react";

export function useDebouncedVersionedSave<TValue>({
  save,
  onSuccess,
  onError,
}: {
  save: (value: TValue) => Promise<void>;
  onSuccess?: (value: TValue) => void;
  onError?: (value: TValue, error: unknown) => void;
}) {
  const timerRef = useRef<number | null>(null);
  const versionRef = useRef(0);
  const saveRef = useRef(save);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    saveRef.current = save;
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [save, onSuccess, onError]);

  useEffect(
    () => () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
      }
    },
    [],
  );

  function schedule(value: TValue, debounceMs: number) {
    const version = versionRef.current + 1;
    versionRef.current = version;
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void saveRef.current(value)
        .then(() => {
          if (versionRef.current === version) {
            onSuccessRef.current?.(value);
          }
        })
        .catch((error: unknown) => {
          if (versionRef.current === version) {
            onErrorRef.current?.(value, error);
          }
        });
    }, debounceMs);
  }

  return { schedule };
}

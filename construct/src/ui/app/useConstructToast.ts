import { useEffect, useRef, useState } from 'react';

export type ConstructToastState = {
  key: number;
  message: string;
};

export const useConstructToast = () => {
  const [toast, setToast] = useState<ConstructToastState | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextKeyRef = useRef(0);

  const setStatus = (message: string) => {
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);

    nextKeyRef.current += 1;
    setToast({ key: nextKeyRef.current, message });

    clearTimerRef.current = setTimeout(() => {
      setToast(null);
      clearTimerRef.current = null;
    }, 2500);
  };

  useEffect(
    () => () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    },
    [],
  );

  return { toast, setStatus };
};

export type UseConstructToastResult = ReturnType<typeof useConstructToast>;

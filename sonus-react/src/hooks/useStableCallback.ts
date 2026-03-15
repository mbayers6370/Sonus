import { useCallback, useEffect, useRef } from 'react';

export function useStableCallback<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult
): (...args: TArgs) => TResult {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);
  return useCallback((...args: TArgs) => fnRef.current(...args), []);
}

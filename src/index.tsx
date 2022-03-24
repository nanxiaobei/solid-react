import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useLayoutEffect,
} from 'react';
import type { Dispatch, SetStateAction } from 'react';

type GetValue<T> = () => T;
type SetValue<T> = Dispatch<SetStateAction<T>>;

const isSSR = typeof window === 'undefined';
const useIsomorphicLayoutEffect = isSSR ? useEffect : useLayoutEffect;
const uniqueCallbacks = new Set<() => void>();
let currentCallback: (() => void) | null = null;

export function useSignal<T>(initialValue: T): [GetValue<T>, SetValue<T>] {
  const valRef = useRef<T>(initialValue as T);
  const listeners = useRef<SetValue<T>[]>([]);

  const hasUpdate = useRef(false);
  const callbacks = useRef<(() => void)[]>([]);
  const runCallbacks = useRef(() => {
    callbacks.current.forEach((fn) => fn());
    setTimeout(() => uniqueCallbacks.clear(), 10);
  });

  const Render = () => {
    const [value, setValue] = useState(valRef.current);

    useIsomorphicLayoutEffect(() => {
      listeners.current.push(setValue);
      return () => {
        listeners.current.splice(listeners.current.indexOf(setValue), 1);
      };
    }, []);

    useIsomorphicLayoutEffect(() => {
      if (hasUpdate.current) {
        hasUpdate.current = false;
        runCallbacks.current();
      }
    });

    return value as unknown as JSX.Element;
  };

  return useMemo(() => {
    const getter = () => {
      try {
        if (currentCallback) {
          callbacks.current.push(currentCallback);
          return valRef.current;
        }
        useState(); // eslint-disable-line react-hooks/rules-of-hooks
        return (<Render />) as unknown as T;
      } catch (e) {
        return valRef.current;
      }
    };
    const setter = (val: SetStateAction<T>) => {
      const getNext = (prev: T) => (val instanceof Function ? val(prev) : val);
      if (listeners.current.length === 0) {
        valRef.current = getNext(valRef.current);
        runCallbacks.current();
        return;
      }
      listeners.current.forEach((listener) => {
        listener((prev) => {
          const next = getNext(prev);
          valRef.current = next;
          return next;
        });
      });
      hasUpdate.current = true;
    };
    return [getter, setter];
  }, []);
}

export function useUpdate(fn: () => void) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useIsomorphicLayoutEffect(() => {
    const callback = () => {
      if (uniqueCallbacks.has(callback)) return;
      uniqueCallbacks.add(callback);
      fnRef.current();
    };
    currentCallback = callback;
    fnRef.current();
    currentCallback = null;
  }, []);
}

export function useAuto<T>(fn: GetValue<T>): GetValue<T> {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const initVal = useMemo(() => {
    const callback = () => {
      if (uniqueCallbacks.has(callback)) return;
      uniqueCallbacks.add(callback);
      setterRef.current(fnRef.current());
    };

    currentCallback = callback;
    const val = fnRef.current();
    currentCallback = null;
    return val;
  }, []);

  const [value, setValue] = useSignal<T>(initVal);
  const setterRef = useRef(setValue);
  return value;
}

export function useMount(fn: () => void) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useIsomorphicLayoutEffect(() => fnRef.current(), []);
}

export function useCleanup(fn: () => void) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useIsomorphicLayoutEffect(() => () => fnRef.current(), []);
}

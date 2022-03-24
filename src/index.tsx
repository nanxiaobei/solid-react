import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom';
import type { Dispatch, SetStateAction } from 'react';

type GetValue<T> = () => T;
type SetValue<T> = Dispatch<SetStateAction<T>>;

const isSSR = typeof window === 'undefined';
const useIsomorphicLayoutEffect = isSSR ? useEffect : useLayoutEffect;
const bulk = ReactDOM.unstable_batchedUpdates;
const batch = (updater: () => void) => (bulk ? bulk(updater) : updater());

const onceCallbacks = new Set<() => void>();
let currentCallback: (() => void) | null = null;

export function useSignal<T>(initialValue: T): [GetValue<T>, SetValue<T>] {
  const valRef = useRef<T>(initialValue as T);
  const listeners = useRef<SetValue<T>[]>([]);

  const hasUpdate = useRef(false);
  const callbacks = useRef<(() => void)[]>([]);
  const runCallbacks = () => {
    batch(() => {
      callbacks.current.forEach((cb) => {
        if (onceCallbacks.has(cb)) return;
        onceCallbacks.add(cb);
        cb();
      });
    });
    setTimeout(() => onceCallbacks.clear(), 10);
  };

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
        runCallbacks();
      }
    });

    return value as unknown as JSX.Element;
  };

  const getter = useRef(() => {
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
  });

  const setter = useRef((val: SetStateAction<T>) => {
    const getNext = (prev: T) => (val instanceof Function ? val(prev) : val);
    if (listeners.current.length === 0) {
      valRef.current = getNext(valRef.current);
      runCallbacks();
      return;
    }
    batch(() => {
      listeners.current.forEach((listener) => {
        listener((prev) => {
          const next = getNext(prev);
          valRef.current = next;
          return next;
        });
      });
    });
    hasUpdate.current = true;
  });

  return [getter.current, setter.current];
}

export function useUpdate(fn: () => void) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const isFirst = useRef(true);
  useIsomorphicLayoutEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;

      currentCallback = fnRef.current;
      fnRef.current();
      currentCallback = null;
    }
  }, []);
}

export function useAuto<T>(fn: GetValue<T>): GetValue<T> {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const isFirst = useRef(true);
  const initVal = useRef<any>();

  if (isFirst.current) {
    isFirst.current = false;

    currentCallback = () => setValue(fnRef.current());
    initVal.current = fnRef.current();
    currentCallback = null;
  }

  const [value, setValue] = useSignal<T>(initVal.current);
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

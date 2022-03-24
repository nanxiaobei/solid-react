import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom';
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';

type GetValue<T> = () => T;
type SetValue<T> = Dispatch<SetStateAction<T>>;
type CbRefObj = MutableRefObject<() => void>;

const isSSR = typeof window === 'undefined';
const useIsomorphicLayoutEffect = isSSR ? useEffect : useLayoutEffect;
const batch = ReactDOM.unstable_batchedUpdates || ((fn: () => void) => fn());

const doneCbRefs = new Set<CbRefObj>();
let currentCbRef: CbRefObj | null = null;

export function useSignal<T>(initialValue: T): [GetValue<T>, SetValue<T>] {
  const valRef = useRef<T>(initialValue as T);
  const listeners = useRef<SetValue<T>[]>([]);

  const hasMount = useRef(false);
  const hasUpdate = useRef(false);
  const cbRefList = useRef<CbRefObj[]>([]);
  const batchRunCbList = () => {
    batch(() => {
      cbRefList.current.forEach((ref) => {
        if (doneCbRefs.has(ref)) return;
        doneCbRefs.add(ref);
        ref.current();
      });
    });
    setTimeout(() => doneCbRefs.clear(), 10);
  };

  useIsomorphicLayoutEffect(() => {
    if (!hasMount.current) {
      hasMount.current = true;
      return;
    }

    batchRunCbList();
  }, []);

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
        batchRunCbList();
      }
    });

    return value as unknown as JSX.Element;
  };

  const getter = useRef(() => {
    try {
      if (currentCbRef) {
        cbRefList.current.push(currentCbRef);
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
      batchRunCbList();
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
  const cbRef = useRef(fn);
  cbRef.current = fn;

  const isFirst = useRef(true);
  useIsomorphicLayoutEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;

      currentCbRef = cbRef;
      cbRef.current();
      currentCbRef = null;
    }
  }, []);
}

export function useAuto<T>(fn: GetValue<T>): GetValue<T> {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const cbRef = useRef(() => setValue(fnRef.current()));

  const isFirst = useRef(true);
  const initVal = useRef<any>();

  if (isFirst.current) {
    isFirst.current = false;

    currentCbRef = cbRef;
    initVal.current = fnRef.current();
    currentCbRef = null;
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

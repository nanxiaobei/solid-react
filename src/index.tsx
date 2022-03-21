import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useLayoutEffect,
} from 'react';
import type { Dispatch, SetStateAction } from 'react';

type Callback = () => void;
type GetValue<T> = () => T;
type SetValue<T> = Dispatch<SetStateAction<T>>;

let currentMemo: null | Callback = null;
let currentEffect: null | Callback = null;

let doneTimer: ReturnType<typeof setTimeout>;
const doneMemos: Callback[] = [];
const doneEffects: Callback[] = [];

export function useSignal<T>(initialValue?: T): [GetValue<T>, SetValue<T>] {
  const valueRef = useRef<T>(initialValue as T);

  const listeners = useRef<SetValue<T>[]>([]);
  const addListener = useRef((setValue: SetValue<T>) => {
    listeners.current.push(setValue);
  });
  const delListener = useRef((setValue: SetValue<T>) => {
    listeners.current.splice(listeners.current.indexOf(setValue));
  });

  const hasMemo = useRef(false);
  const memos = useRef<Callback[]>([]);
  const runMemos = useRef(() => {
    if (hasMemo.current) {
      memos.current.forEach((memo) => {
        if (doneMemos.indexOf(memo) > -1) return;
        doneMemos.push(memo);
        memo();
      });
      hasMemo.current = false;
    }
  });

  const hasEffect = useRef(false);
  const effects = useRef<Callback[]>([]);
  const runEffects = useRef(() => {
    if (hasEffect.current) {
      effects.current.forEach((effect) => {
        if (doneEffects.indexOf(effect) > -1) return;
        doneEffects.push(effect);
        effect();
      });
      hasEffect.current = false;
    }
  });

  const clearDoneCallbacks = useRef(() => {
    clearTimeout(doneTimer);
    doneTimer = setTimeout(() => {
      doneMemos.length = 0;
      doneEffects.length = 0;
    }, 10);
  });

  const Render = () => {
    const [value, setValue] = useState(valueRef.current);
    useMemo(() => addListener.current(setValue), []);
    useEffect(() => () => delListener.current(setValue), []);

    useLayoutEffect(() => runMemos.current());
    useLayoutEffect(() => runEffects.current());
    useEffect(() => clearDoneCallbacks.current());

    return value as unknown as JSX.Element;
  };

  return useMemo(
    () => [
      () => {
        try {
          if (currentMemo) {
            memos.current.push(currentMemo);
            return valueRef.current;
          }

          if (currentEffect) {
            effects.current.push(currentEffect);
            return valueRef.current;
          }

          useState(); // eslint-disable-line react-hooks/rules-of-hooks

          return (<Render />) as unknown as T;
        } catch (e) {
          return valueRef.current;
        }
      },
      (newValue) => {
        listeners.current.forEach((listener) => {
          listener((prevValue) => {
            let nextValue;
            if (newValue instanceof Function) {
              nextValue = newValue(prevValue);
            } else {
              nextValue = newValue;
            }

            valueRef.current = nextValue;
            return nextValue;
          });
        });

        hasMemo.current = true;
        hasEffect.current = true;
      },
    ],
    []
  );
}

export function useUpdate(fn: Callback) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    currentEffect = fnRef.current;
    fnRef.current();
    currentEffect = null;
  }, []);
}

export function useAuto<T>(fn: GetValue<T>): GetValue<T> {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const valRef = useRef<T>();

  useMemo(() => {
    currentMemo = () => setterRef.current(fnRef.current());
    valRef.current = fnRef.current();
    currentMemo = null;
  }, []);

  const [value, setValue] = useSignal<T>(valRef.current);
  const setterRef = useRef(setValue);

  return value;
}

export function useMount(fn: Callback) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => fnRef.current(), []);
}

export function useCleanup(fn: Callback) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => () => fnRef.current(), []);
}

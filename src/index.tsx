import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useLayoutEffect,
} from 'react';
import ReactDOM from 'react-dom';
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';

type GetValue<T> = () => T;
type SetValue<T> = Dispatch<SetStateAction<T>>;
type Flow = {
  arrIndex: number;
  liveDeps: Map<MutableRefObject<any>, () => void>;
  deadDeps: Map<MutableRefObject<any>, () => void>;
  callback: (_isUpdate: boolean) => void;
};
type Flows = Set<Flow>;

const isSSR = typeof window === 'undefined';
const useIsomorphicLayoutEffect = isSSR ? useEffect : useLayoutEffect;
const batch = ReactDOM.unstable_batchedUpdates || ((fn: () => void) => fn());

let currentFlow: Flow | null = null;
const allFlows = new Set<Flow>();

const runFlows = (flows: Flows) => {
  batch(() => {
    flows.forEach((flow) => {
      if (allFlows.has(flow)) return;
      allFlows.add(flow);

      flow.deadDeps = flow.liveDeps;
      flow.liveDeps = new Map();
      flow.callback(true);
      flow.deadDeps.forEach((remove) => remove());
    });
  });
  setTimeout(() => allFlows.clear());
};

export function useSignal<T>(initialValue: T): [GetValue<T>, SetValue<T>] {
  const valueRef = useRef<T>(initialValue as T);
  const listeners = useRef<SetValue<T>[]>([]);

  const hasUpdate = useRef(false);
  const flowsArr = useRef<Flows[]>(null as unknown as Flows[]);
  if (!flowsArr.current) flowsArr.current = [new Set(), new Set()];

  const isFirst = useRef(true);
  useIsomorphicLayoutEffect(() => {
    isFirst.current ? (isFirst.current = false) : runFlows(flowsArr.current[0]);
  }, []);

  const Render = () => {
    const [value, setValue] = useState(valueRef.current);

    useIsomorphicLayoutEffect(() => {
      listeners.current.push(setValue);
      return () => {
        listeners.current.splice(listeners.current.indexOf(setValue), 1);
      };
    }, []);

    useIsomorphicLayoutEffect(() => {
      if (hasUpdate.current) {
        hasUpdate.current = false;
        flowsArr.current.forEach((flows) => runFlows(flows));
      }
    });

    return value as unknown as JSX.Element;
  };

  return useMemo(() => {
    flowsArr.current.forEach((flows) => flows.clear());

    return [
      () => {
        try {
          if (currentFlow) {
            const flow = currentFlow;
            const flows = flowsArr.current[flow.arrIndex];

            flows.add(flow);
            flow.deadDeps.delete(valueRef);
            flow.liveDeps.set(valueRef, () => flows.delete(flow));
            return valueRef.current;
          }
          useState(); // eslint-disable-line react-hooks/rules-of-hooks
          return (<Render />) as unknown as T;
        } catch (e) {
          return valueRef.current;
        }
      },
      (payload: SetStateAction<T>) => {
        const getNext = (prev: T) =>
          payload instanceof Function ? payload(prev) : payload;

        if (listeners.current.length === 0) {
          valueRef.current = getNext(valueRef.current);
          flowsArr.current.forEach((flows) => runFlows(flows));
          return;
        }

        batch(() => {
          listeners.current.forEach((listener) => {
            listener((prev) => (valueRef.current = getNext(prev)));
          });
        });
        hasUpdate.current = true;
      },
    ];
  }, []);
}

export function useUpdate(fn: () => void) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useIsomorphicLayoutEffect(() => {
    const flow = {
      arrIndex: 1,
      liveDeps: new Map(),
      deadDeps: new Map(),
      callback: (_isUpdate: boolean) => {
        currentFlow = flow;
        fnRef.current();
        currentFlow = null;
      },
    };
    flow.callback(false);
  }, []);
}

export function useAuto<T>(fn: GetValue<T>): GetValue<T> {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const setter = useRef<any>();

  const initVal = useMemo(() => {
    const flow = {
      arrIndex: 0,
      liveDeps: new Map(),
      deadDeps: new Map(),
      callback: (_isUpdate: boolean) => {
        currentFlow = flow;
        const val = fnRef.current();
        _isUpdate && setter.current(val);
        currentFlow = null;
        return val;
      },
    };
    return flow.callback(false);
  }, []);

  const [value, setValue] = useSignal<T>(initVal);
  setter.current = setValue;

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

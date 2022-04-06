import React, {
  useState,
  useEffect,
  useCallback,
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
type FlowSet = Set<Flow>;
type RenderProps = { path?: string[]; mapFn?: typeof Array.prototype.map };

const isSSR = typeof window === 'undefined';
const useIsomorphicLayoutEffect = isSSR ? useEffect : useLayoutEffect;
const batch = ReactDOM.unstable_batchedUpdates || ((fn: () => void) => fn());
const isObj = (data: any) => typeof data === 'object';

let currentFlow: Flow | null = null;
const allFlows = new Set<Flow>();

const runFlows = (flows: FlowSet) => {
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
  const valRef = useRef<T>(initialValue as T);
  const listeners = useRef<SetValue<T>[]>([]);

  const hasUpdate = useRef(false);
  const flowsArr = useRef<FlowSet[]>(null as unknown as FlowSet[]);
  if (!flowsArr.current) flowsArr.current = [new Set(), new Set(), new Set()];

  const isFirst = useRef(true);
  useIsomorphicLayoutEffect(() => {
    isFirst.current ? (isFirst.current = false) : runFlows(flowsArr.current[0]);
  }, []);

  const Render = ({ path, mapFn }: RenderProps) => {
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
        flowsArr.current.forEach((flows) => runFlows(flows));
      }
    });

    if (!Array.isArray(path)) return value;
    const val = path.reduce((obj: any, key: string) => obj[key], value);
    return mapFn ? val.map(mapFn) : val;
  };

  const proxy = useCallback((obj: any, path: string[]): T => {
    return new Proxy(obj, {
      get: (target, key: string) => {
        const val = target[key];
        if (key === 'map' && val === Array.prototype.map) {
          return (mapFn: any) => <Render path={path} mapFn={mapFn} />;
        }
        path.push(key);
        return isObj(val) ? proxy(val, path) : <Render path={path} />;
      },
    });
  }, []);

  return useMemo(() => {
    flowsArr.current.forEach((flows) => flows.clear());

    return [
      () => {
        try {
          if (currentFlow) {
            const flow = currentFlow;
            const flows = flowsArr.current[flow.arrIndex];

            flows.add(flow);
            flow.deadDeps.delete(valRef);
            flow.liveDeps.set(valRef, () => flows.delete(flow));
            return valRef.current;
          }

          useState(); // eslint-disable-line react-hooks/rules-of-hooks

          if (isObj(valRef.current)) return proxy(valRef.current, []);
          return (<Render />) as unknown as T;
        } catch (e) {
          return valRef.current;
        }
      },
      (payload: SetStateAction<T>) => {
        const getNext = (prev: T) =>
          payload instanceof Function ? payload(prev) : payload;

        if (listeners.current.length === 0) {
          valRef.current = getNext(valRef.current);
          flowsArr.current.forEach((flows) => runFlows(flows));
          return;
        }

        batch(() => {
          listeners.current.forEach((listener) => {
            listener((prev) => (valRef.current = getNext(prev)));
          });
        });
        hasUpdate.current = true;
      },
    ];
  }, [proxy]);
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

export function Run<T>(fn: GetValue<T>): T {
  return useAuto(fn)();
}

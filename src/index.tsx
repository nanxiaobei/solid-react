import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import ReactDOM from 'react-dom';

type Getter<T> = () => T;
type Setter<T> = Dispatch<SetStateAction<T>>;
type Flow = {
  arrIndex: number;
  liveDeps: Map<MutableRefObject<unknown>, () => void>;
  deadDeps: Map<MutableRefObject<unknown>, () => void>;
  callback: (_isUpdate?: boolean) => void;
};
type FlowSet = Set<Flow>;
type RenderProps = {
  keyPath?: string[];
  mapCallback?: (...args: unknown[]) => unknown;
};

const isSSR = typeof window === 'undefined';
const useIsomorphicLayoutEffect = isSSR ? useEffect : useLayoutEffect;
const batch = ReactDOM.unstable_batchedUpdates || ((fn: () => void) => fn());
const isPrimitive = (data: unknown) => typeof data !== 'object';

let currentFlow: Flow | null = null;
const allFlows = new Set<Flow>();

const runFlows = (flowSet: FlowSet) => {
  batch(() => {
    flowSet.forEach((flow) => {
      if (allFlows.has(flow)) {
        return;
      }

      allFlows.add(flow);

      flow.deadDeps = flow.liveDeps;
      flow.liveDeps = new Map();
      flow.callback(true);
      flow.deadDeps.forEach((remove) => remove());
    });
  });

  setTimeout(() => allFlows.clear());
};

export function useSignal<T>(initialValue: T): [Getter<T>, Setter<T>] {
  const valRef = useRef<T>(initialValue);
  const listeners = useRef<Setter<T>[]>([]);

  const hasUpdate = useRef(false);
  const flowSetArr = useRef<FlowSet[]>(null as unknown as FlowSet[]);
  if (!flowSetArr.current) {
    flowSetArr.current = [new Set(), new Set(), new Set()];
  }

  const isFirst = useRef(true);
  useIsomorphicLayoutEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
    } else {
      runFlows(flowSetArr.current[0]);
    }
  }, []);

  const Render = ({ keyPath, mapCallback }: RenderProps) => {
    const [value, setValue] = useState(valRef.current);

    useIsomorphicLayoutEffect(() => {
      listeners.current.push(setValue);
      return () => {
        const index = listeners.current.indexOf(setValue);
        listeners.current.splice(index, 1);
      };
    }, []);

    useIsomorphicLayoutEffect(() => {
      if (hasUpdate.current) {
        hasUpdate.current = false;
        flowSetArr.current.forEach((flowSet) => runFlows(flowSet));
      }
    });

    if (!Array.isArray(keyPath)) {
      return value;
    }

    const subVal = keyPath.reduce((obj: any, key: string) => obj[key], value);

    return mapCallback ? subVal.map(mapCallback) : subVal;
  };

  const proxy = useCallback((obj: any, keyPath: string[]): T => {
    return new Proxy(obj, {
      get: (target, key: string) => {
        const val = target[key];

        if (key === 'map' && val === Array.prototype.map) {
          const fakeArrayMap = (mapCallback: RenderProps['mapCallback']) => {
            return <Render keyPath={keyPath} mapCallback={mapCallback} />;
          };
          return fakeArrayMap;
        }

        keyPath.push(key);

        if (isPrimitive(val)) {
          return <Render keyPath={keyPath} />;
        }

        return proxy(val, keyPath);
      },
    }) as T;
  }, []);

  return useMemo(() => {
    flowSetArr.current.forEach((flowSet) => flowSet.clear());

    return [
      () => {
        try {
          if (currentFlow) {
            const flow = currentFlow;
            const flowSet = flowSetArr.current[flow.arrIndex];

            flowSet.add(flow);
            flow.deadDeps.delete(valRef);
            flow.liveDeps.set(valRef, () => flowSet.delete(flow));
            return valRef.current;
          }

          // eslint-disable-next-line react-hooks/rules-of-hooks
          useState();

          if (isPrimitive(valRef.current)) {
            return (<Render />) as T;
          }

          return proxy(valRef.current, []);
        } catch (e) {
          return valRef.current;
        }
      },
      (payload: SetStateAction<T>) => {
        const getVal = (prev: T) =>
          payload instanceof Function ? payload(prev) : payload;

        if (listeners.current.length === 0) {
          valRef.current = getVal(valRef.current);
          flowSetArr.current.forEach((flowSet) => runFlows(flowSet));
        } else {
          batch(() => {
            listeners.current.forEach((listener) => {
              listener((prev) => (valRef.current = getVal(prev)));
            });
          });
          hasUpdate.current = true;
        }
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
      callback: () => {
        currentFlow = flow;
        fnRef.current();
        currentFlow = null;
      },
    };

    flow.callback();
  }, []);
}

export function useAuto<T>(fn: Getter<T>): Getter<T> {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const setter = useRef<Setter<T>>(() => undefined);

  const initVal = useMemo(() => {
    const flow = {
      arrIndex: 0,
      liveDeps: new Map(),
      deadDeps: new Map(),
      callback: (_isUpdate?: boolean) => {
        currentFlow = flow;
        const val = fnRef.current();
        if (_isUpdate) {
          setter.current(val);
        }
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

export function Run<T>(fn: Getter<T>): T {
  return useAuto(fn)();
}

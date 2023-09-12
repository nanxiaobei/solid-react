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
  nextUnsubMap: Map<MutableRefObject<unknown>, () => void>;
  willUnsubMap: Map<MutableRefObject<unknown>, () => void>;
  runFlowFn: (isInit?: 'isInit') => void;
};
type Props = {
  path?: string[];
  mapFn?: (...args: unknown[]) => unknown;
};

const isSSR = typeof window === 'undefined';
const useIsomorphicLayoutEffect = isSSR ? useEffect : useLayoutEffect;
const batch = ReactDOM.unstable_batchedUpdates || ((fn: () => void) => fn());
const isPrimitive = (data: unknown) => typeof data !== 'object';

let curFlow: Flow | null = null;
const uniqueFlows = new Set();

const runValFlows = (valFlows: Set<Flow>) => {
  batch(() => {
    // A's valFlows: [flow1, flow2]
    // B's valFlows: [flow1]

    valFlows.forEach((flow) => {
      if (!uniqueFlows.has(flow)) {
        uniqueFlows.add(flow); // use uniqueFlows to only run flow once

        // flow1.nextUnsubMap -> { A: unsubFlow1FromA, B: unsubFlow1FromB }
        // flow1.nextUnsubMap is set in prev `flow1.runFlowFn()` cycle
        flow.willUnsubMap = flow.nextUnsubMap;
        flow.nextUnsubMap = new Map();

        // run below `flow1.runFlowFn()`
        // if access A, means A is still used in flow, so needs to keep A
        // remove A from willUnsubMap, willUnsubMap -> { B: unsubB }, A will keep, only unsub B
        flow.runFlowFn();

        // flow1.willUnsubMap's size, will only reduce, no increase
        // if accessed both A & B, flow1.willUnsubMap -> {}, unsub nothing
        flow.willUnsubMap.forEach((unsubFlowFromVal) => unsubFlowFromVal());
      }
    });
  });
  setTimeout(() => uniqueFlows.clear());
};

export function useSignal<T>(initialValue: T): [Getter<T>, Setter<T>] {
  const valRef = useRef<T>(initialValue);
  const setters = useRef<Setter<T>[]>([]);

  const valFlows = useRef<Set<Flow>>(new Set());
  const valUpdated = useRef(false);

  const View = ({ path, mapFn }: Props) => {
    const [proVal, setProVal] = useState(valRef.current);

    useIsomorphicLayoutEffect(() => {
      setters.current.push(setProVal);
      return () => {
        const index = setters.current.indexOf(setProVal);
        setters.current.splice(index, 1);
      };
    }, []);

    useIsomorphicLayoutEffect(() => {
      if (valUpdated.current) {
        valUpdated.current = false;
        runValFlows(valFlows.current);
      }
    });

    if (Array.isArray(path)) {
      const realVal = path.reduce((obj: any, key: string) => obj[key], proVal);
      if (mapFn) return realVal.map(mapFn);
      return realVal;
    }

    return proVal;
  };

  const getDeep = useCallback((obj: any, path: string[]): T => {
    return new Proxy(obj, {
      get: (target, key: string) => {
        const val = target[key];

        if (key === 'map' && val === Array.prototype.map) {
          return (mapFn: Props['mapFn']) => <View path={path} mapFn={mapFn} />;
        }

        path.push(key);

        if (isPrimitive(val)) {
          return <View path={path} />;
        }

        return getDeep(val, path);
      },
    }) as T;
  }, []);

  return useMemo(() => {
    valFlows.current.clear();

    return [
      () => {
        try {
          // in `runFlowFn()` has access several value getters,
          // if access current signal's value, will reach here
          if (curFlow) {
            const flow = curFlow;

            valFlows.current.add(flow);
            flow.nextUnsubMap.set(valRef, () => valFlows.current.delete(flow)); // use for next `runValFlows()`
            flow.willUnsubMap.delete(valRef); // delete value from map, so will not unsub value
            return valRef.current;
          }

          // eslint-disable-next-line react-hooks/rules-of-hooks
          useState();

          if (isPrimitive(valRef.current)) {
            return (<View />) as T;
          }

          return getDeep(valRef.current, []);
        } catch (e) {
          return valRef.current;
        }
      },
      (v: SetStateAction<T>) => {
        valRef.current = v instanceof Function ? v(valRef.current) : v;

        if (setters.current.length > 0) {
          batch(() => setters.current.forEach((set) => set(valRef.current)));
          valUpdated.current = true;
        } else {
          runValFlows(valFlows.current);
        }
      },
    ];
  }, [getDeep]);
}

export function useUpdate(fn: () => void) {
  const flowRef = useRef({
    nextUnsubMap: new Map(),
    willUnsubMap: new Map(),
    runFlowFn: () => {
      curFlow = flowRef.current;
      fn();
      curFlow = null;
    },
  });

  useIsomorphicLayoutEffect(() => {
    flowRef.current.runFlowFn();
  }, []);
}

export function useAuto<T>(fn: Getter<T>): Getter<T> {
  const flowRef = useRef({
    nextUnsubMap: new Map(),
    willUnsubMap: new Map(),
    runFlowFn: (isInit?: 'isInit') => {
      curFlow = flowRef.current;

      const val = fn();
      if (!isInit) setAutoVal(val);

      curFlow = null;
      return val;
    },
  });

  const initialVal = useMemo(() => flowRef.current.runFlowFn('isInit'), []);
  const [autoVal, setAutoVal] = useSignal<T>(initialVal);
  return autoVal;
}

export function useMount(fn: () => void) {
  useIsomorphicLayoutEffect(() => fn(), []);
}

export function useCleanup(fn: () => void) {
  useIsomorphicLayoutEffect(() => () => fn(), []);
}

export function Run<T>(fn: Getter<T>): T {
  return useAuto(fn)();
}

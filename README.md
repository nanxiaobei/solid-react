# solid-react

Hooks for a SolidJS-like React

[![npm](https://img.shields.io/npm/v/solid-react?style=flat-square)](https://www.npmjs.com/package/solid-react)
[![GitHub Workflow Status](https://img.shields.io/github/workflow/status/nanxiaobei/solid-react/Test?style=flat-square)](https://github.com/nanxiaobei/solid-react/actions?query=workflow%3ATest)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/solid-react?style=flat-square)](https://bundlephobia.com/result?p=solid-react)
[![npm type definitions](https://img.shields.io/npm/types/typescript?style=flat-square)](https://github.com/nanxiaobei/solid-react/blob/main/src/index.ts)
[![GitHub](https://img.shields.io/github/license/nanxiaobei/solid-react?style=flat-square)](https://github.com/nanxiaobei/solid-react/blob/main/LICENSE)

## API

### `useSignal`

```js
const [count, setCount] = useSignal(0);

// count is a getter function, useSignal returns a getter and a setter
return <div>{count()}</div>;
```

### `useUpdate`

```js
const [count, setCount] = useSignal(0);

// this effect prints count at the beginning and when it changes
useUpdate(() => console.log('count:', count()));
```

### `useAuto`

```js
const value = useAuto(() => computeExpensiveValue(a(), b()));

// read value
value();
```

### `useMount`

```js
// register a method that runs after initial render
useMount(() => console.log('mounted'));
```

### `useCleanup`

```js
el.addEventListener(event, callback);

// register a cleanup method that runs when unmount
useCleanup(() => el.removeEventListener(event, callback));
```

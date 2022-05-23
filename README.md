# 🧿 solid-react

Hooks for a SolidJS-like React

[![npm](https://img.shields.io/npm/v/solid-react?style=flat-square)](https://www.npmjs.com/package/solid-react)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/solid-react?style=flat-square)](https://bundlephobia.com/result?p=solid-react)
[![npm type definitions](https://img.shields.io/npm/types/typescript?style=flat-square)](https://github.com/nanxiaobei/solid-react/blob/main/src/index.ts)
[![GitHub](https://img.shields.io/github/license/nanxiaobei/solid-react?style=flat-square)](https://github.com/nanxiaobei/solid-react/blob/main/LICENSE)

## Install

```bash
pnpm add solid-react
# or
yarn add solid-react
# or
npm i solid-react
```

## Demo

[![Edit solid-react](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/solid-react-rymhr6?fontsize=14&hidenavigation=1&theme=dark)

## API

### `useSignal`

```js
import { useSignal } from 'solid-react';

const [count, setCount] = useSignal(0);

const countDisplay = <div>{count()}</div>;
```

Returns a getter and a setter. (like `createSignal`)

### `useUpdate`

```js
import { useUpdate } from 'solid-react';

const [count, setCount] = useSignal(0);

useUpdate(() => console.log('count:', count()));
```

The callback runs at mount and when its dependencies change. (like `createEffect`)

### `useAuto`

```js
import { useAuto } from 'solid-react';

const value = useAuto(() => computeExpensiveValue(a(), b()));

value();
```

Returns a computed value getter, re-compute when dependencies change. (like `createMemo`)

### `useMount`

```js
import { useMount } from 'solid-react';

useMount(() => console.log('mounted'));
```

Register a method that runs after initial render. (like `onMount`)

### `useCleanup`

```js
import { useCleanup } from 'solid-react';

el.addEventListener(event, callback);

useCleanup(() => el.removeEventListener(event, callback));
```

Register a cleanup method that runs when unmount. (like `onCleanup`)

### `Run`

```js
import { Run } from 'solid-react';

<div>{Run(() => (a() ? b() : c()))}</div>;
<div>{Run(() => Object.keys(obj())).map((e) => e)}</div>;
```

A helper function for conditional operator or executions in jsx.

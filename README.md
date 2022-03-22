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

## API

---

> **Basic Reactivity**

### `useSignal`

```js
import { useSignal } from 'solid-react'; // createSignal

const [count, setCount] = useSignal(0);

// count is a getter function, useSignal returns a getter and a setter
return <div>{count()}</div>;
```

### `useUpdate`

```js
import { useUpdate } from 'solid-react'; // createEffect

const [count, setCount] = useUpdate(0);

// this effect prints count at the beginning and when it changes
useUpdate(() => console.log('count:', count()));
```

### `useAuto`

```js
import { useAuto } from 'solid-react'; // createMemo

const value = useAuto(() => computeExpensiveValue(a(), b()));

// read value
value();
```

---

> **Lifecycles**

### `useMount`

```js
import { useMount } from 'solid-react'; // onMount

// register a method that runs after initial render
useMount(() => console.log('mounted'));
```

### `useCleanup`

```js
import { useCleanup } from 'solid-react'; // onCleanup

el.addEventListener(event, callback);

// register a cleanup method that runs when unmount
useCleanup(() => el.removeEventListener(event, callback));
```

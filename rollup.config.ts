import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';
import pkg from './package.json';

const input = 'src/index.tsx';
const deps = Object.keys(pkg.peerDependencies);
const external = (id: string) => deps.includes(id);
const plugins = [typescript()];

const cjsOutput = { file: pkg.main, format: 'cjs', exports: 'auto' };
const esmOutput = { file: pkg.module, format: 'es' };
const dtsOutput = { file: pkg.types, format: 'es' };

export default [
  { input, output: cjsOutput, external, plugins },
  { input, output: esmOutput, external, plugins },
  { input, output: dtsOutput, plugins: [dts()] },
];

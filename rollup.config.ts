import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';
import pkg from './package.json';

const input = 'src/index.tsx';
const plugins = [typescript()];
const peer = Object.keys(pkg.peerDependencies);
const external = (id: string) => peer.includes(id);

const cjsOutput = { file: pkg.main, format: 'cjs', exports: 'auto' };
const esmOutput = { file: pkg.module, format: 'es' };
const dtsOutput = { file: pkg.types, format: 'es' };

export default [
  { input, output: cjsOutput, plugins, external },
  { input, output: esmOutput, plugins, external },
  { input, output: dtsOutput, plugins: [dts()] },
];

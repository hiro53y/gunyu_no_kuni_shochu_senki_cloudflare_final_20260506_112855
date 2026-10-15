import { EventEmitter } from 'node:events';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';

const originalExec = childProcess.exec;

childProcess.exec = function patchedExec(command, ...args) {
  if (process.platform === 'win32' && command === 'net use') {
    const callback = args.find((arg) => typeof arg === 'function');
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => true;
    process.nextTick(() => {
      if (callback) callback(new Error('Skipped net use lookup for local Vite build'), '', '');
      child.emit('close', 0);
    });
    return child;
  }
  return originalExec.call(childProcess, command, ...args);
};
syncBuiltinESMExports();

const { build } = await import('vite');
const react = (await import('@vitejs/plugin-react')).default;

await build({
  configFile: false,
  plugins: [react()],
});

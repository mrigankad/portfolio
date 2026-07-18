import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const tmp = join('tests', '.tmp');
const haveFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;

test('lastframe extracts a PNG from a clip', { skip: !haveFfmpeg && 'ffmpeg not installed' }, () => {
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const clip = join(tmp, 'sample.mp4');
  execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=red:s=64x36:d=1',
    '-pix_fmt', 'yuv420p', clip], { stdio: 'ignore' });
  execFileSync('node', ['tools/process-clips.mjs', 'lastframe', clip]);
  assert.ok(existsSync(join(tmp, 'sample.last.png')));
});

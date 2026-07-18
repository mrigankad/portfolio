// Compress curated GLB models from the old portfolio into public/assets/models/.
// Draco geometry compression + WebP textures capped at 1024px, plus a 640px
// WebP thumbnail from each model's existing render. Run: node tools/optimize-models.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'C:/Users/mriga_ijtdono/Desktop/Mriganka/Portfolio/public/models';
const OUT = 'public/assets/models';

const MODELS = [
  { id: 'all-for-one-chaos', dir: 'characters/all-for-one', glb: 'all-for-one-chaos', thumb: 'all-for-one-chaos.png', title: 'All For One: Chaos' },
  { id: 'armored-all-might', dir: 'characters/all-might', glb: 'toshinori-yagi-armored-all-might', thumb: 'toshinori-yagi-armored-all-might.png', title: 'Armored All Might' },
  { id: 'best-jeanist', dir: 'characters/best-jeanist', glb: 'best-jeanist', thumb: 'best-jeanist.png', title: 'Best Jeanist' },
  { id: 'camie-utsushimi', dir: 'characters/camie-utsushimi', glb: 'camie-utsushimi-illus-o-camie', thumb: 'camie-utsushimi-illus-o-camie.png', title: 'Camie Utsushimi' },
  { id: 'gundam-barbatos', dir: 'mecha/1asw-g-08-gundam-barbatos-1st-form', glb: '1asw-g-08-gundam-barbatos-1st-form', thumb: '1asw-g-08-gundam-barbatos-1st-form-cover.png', title: 'Gundam Barbatos (1st form)' },
  { id: 'aile-strike', dir: 'mecha/aile-strike-hg', glb: 'aile-strike-hg', thumb: 'aile-strike-hg-cover.png', title: 'Aile Strike Gundam' },
  { id: 'akatsuki-oowashi', dir: 'mecha/akatsuki-oowashi-hg', glb: 'akatsuki-oowashi-hg', thumb: 'akatsuki-oowashi-hg-cover.png', title: 'Akatsuki Oowashi' },
  { id: 'acguy', dir: 'mecha/acguy-hg', glb: 'acguy-hg', thumb: 'acguy-hg-cover.png', title: 'Acguy' },
];

mkdirSync(OUT, { recursive: true });
const mb = (f) => (statSync(f).size / 1048576).toFixed(1);

for (const m of MODELS) {
  const src = join(SRC, m.dir, `${m.glb}.glb`);
  const thumbSrc = join(SRC, m.dir, m.thumb);
  if (!existsSync(src)) { console.error(`MISSING ${src}`); process.exitCode = 1; continue; }
  const outGlb = join(OUT, `${m.id}.glb`);
  execFileSync('npx', ['gltf-transform', 'optimize', src, outGlb,
    '--compress', 'draco', '--texture-compress', 'webp', '--texture-size', '1024'],
    { stdio: 'ignore', shell: true });
  if (existsSync(thumbSrc)) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', thumbSrc,
      '-vf', 'scale=640:-2', '-quality', '80', join(OUT, `${m.id}.webp`)]);
  } else {
    console.error(`no thumb for ${m.id}`);
  }
  console.log(`${m.id}: ${mb(src)} MB -> ${mb(outGlb)} MB`);
}

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const updaterPublicKey = process.env.TINKER_UPDATER_PUBLIC_KEY?.trim();
if (!updaterPublicKey) {
  throw new Error('TINKER_UPDATER_PUBLIC_KEY is required.');
}

const repository = process.env.GITHUB_REPOSITORY?.trim();
if (!repository) {
  throw new Error('GITHUB_REPOSITORY is required.');
}

const bundleTargets = (process.env.TINKER_RELEASE_BUNDLE_TARGETS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter((value) => value.length > 0);

if (bundleTargets.length === 0) {
  throw new Error('TINKER_RELEASE_BUNDLE_TARGETS must contain at least one bundle target.');
}

const configPath = resolve('src-tauri', 'tauri.release.conf.json');
const config = {
  bundle: {
    createUpdaterArtifacts: true,
    targets: bundleTargets,
  },
  plugins: {
    updater: {
      pubkey: updaterPublicKey,
      endpoints: [`https://github.com/${repository}/releases/latest/download/latest.json`],
    },
  },
};

await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

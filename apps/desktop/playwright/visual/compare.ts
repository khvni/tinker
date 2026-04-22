import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const MAX_DRIFT_RATIO = 0.02;
const PIXELMATCH_THRESHOLD = 0.1;

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const BASELINE_DIR = resolve(REPO_ROOT, 'test-assets', 'baselines');
const OUTPUT_DIR = resolve(REPO_ROOT, 'test-output');

type CompareResult =
  | { status: 'seeded'; baselinePath: string }
  | { status: 'updated'; baselinePath: string }
  | { status: 'match'; driftRatio: number; diffPixels: number }
  | {
      status: 'drift';
      driftRatio: number;
      diffPixels: number;
      diffPath: string;
      actualPath: string;
      baselinePath: string;
      message: string;
    };

const ensureDir = (path: string): void => {
  mkdirSync(path, { recursive: true });
};

const writePng = (path: string, png: PNG): void => {
  ensureDir(dirname(path));
  writeFileSync(path, PNG.sync.write(png));
};

const readPng = (path: string): PNG => PNG.sync.read(readFileSync(path));

const shouldUpdateBaselines = (): boolean => process.env['UPDATE_BASELINES'] === '1';

export const compareSnapshot = (name: string, actualBuffer: Buffer): CompareResult => {
  const baselinePath = join(BASELINE_DIR, `${name}.png`);
  const actualPath = join(OUTPUT_DIR, `${name}.actual.png`);
  const diffPath = join(OUTPUT_DIR, `${name}.diff.png`);
  const actualPng = PNG.sync.read(actualBuffer);

  if (shouldUpdateBaselines()) {
    writePng(baselinePath, actualPng);
    return { status: 'updated', baselinePath };
  }

  if (!existsSync(baselinePath)) {
    writePng(baselinePath, actualPng);
    return { status: 'seeded', baselinePath };
  }

  const baselinePng = readPng(baselinePath);
  if (baselinePng.width !== actualPng.width || baselinePng.height !== actualPng.height) {
    writePng(actualPath, actualPng);
    return {
      status: 'drift',
      driftRatio: 1,
      diffPixels: actualPng.width * actualPng.height,
      diffPath,
      actualPath,
      baselinePath,
      message:
        `Dimension mismatch for "${name}": baseline ${baselinePng.width}x${baselinePng.height}, ` +
        `actual ${actualPng.width}x${actualPng.height}. ` +
        'Regenerate baselines via pnpm --filter @tinker/desktop test:visual:update.',
    };
  }

  const { width, height } = baselinePng;
  const diffPng = new PNG({ width, height });
  const diffPixels = pixelmatch(baselinePng.data, actualPng.data, diffPng.data, width, height, {
    threshold: PIXELMATCH_THRESHOLD,
  });
  const driftRatio = diffPixels / (width * height);

  if (driftRatio > MAX_DRIFT_RATIO) {
    writePng(diffPath, diffPng);
    writePng(actualPath, actualPng);
    return {
      status: 'drift',
      driftRatio,
      diffPixels,
      diffPath,
      actualPath,
      baselinePath,
      message:
        `Visual drift for "${name}": ${(driftRatio * 100).toFixed(2)}% of pixels differ ` +
        `(${diffPixels} px, budget ${(MAX_DRIFT_RATIO * 100).toFixed(0)}%). ` +
        `Review ${diffPath}. If intentional, update via pnpm --filter @tinker/desktop test:visual:update.`,
    };
  }

  return { status: 'match', driftRatio, diffPixels };
};

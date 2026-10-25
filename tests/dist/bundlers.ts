import { build } from "esbuild";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { rollup } from "rollup";

export const DIST_ESM: string = fileURLToPath(new URL("../../dist/index.js", import.meta.url));
export const DIST_CJS: string = fileURLToPath(new URL("../../dist/index.cjs", import.meta.url));

export function assertDistBuilt(): void {
  if (!existsSync(DIST_ESM) || !existsSync(DIST_CJS)) {
    throw new Error("dist/ is missing. Run `pnpm build` (or `pnpm test:dist`) first.");
  }
}

/** Source of a consumer module that imports only `names` from the built package. */
export function consumer(names: readonly string[]): string {
  const specifier: string = JSON.stringify(DIST_ESM);
  if (names.length === 0) {
    return `import ${specifier};`;
  }
  const bindings: string = names
    .map((name: string, i: number): string => `${name} as _${i}`)
    .join(", ");
  const uses: string = names.map((_name: string, i: number): string => `_${i}`).join(", ");
  return `import { ${bindings} } from ${specifier};\nconsole.log(${uses});`;
}

/**
 * esbuild honours `"sideEffects": false` from package.json, like webpack/Vite/Rollup+node-resolve do.
 */
export async function bundleWithEsbuild(source: string, minify: boolean = true): Promise<string> {
  const result = await build({
    stdin: { contents: source, resolveDir: process.cwd() },
    bundle: true,
    write: false,
    minify,
    format: "esm",
    platform: "neutral",
    external: ["@microsoft/signalr"],
    logLevel: "silent",
  });
  return result.outputFiles[0]?.text ?? "";
}

/**
 * Rollup with its defaults (`moduleSideEffects: true`) and no package.json resolution,
 * so the `sideEffects` flag is NOT trusted: anything left over is code Rollup could
 * not prove pure. This catches top-level side effects the flag would otherwise hide.
 */
export async function bundleWithRollup(source: string): Promise<string> {
  const bundle = await rollup({
    input: "consumer",
    external: ["@microsoft/signalr"],
    onwarn: (): void => {},
    plugins: [
      {
        name: "virtual-consumer",
        resolveId: (id: string): string | null => (id === "consumer" ? id : null),
        load: (id: string): string | null => (id === "consumer" ? source : null),
      },
    ],
  });
  try {
    const { output } = await bundle.generate({ format: "es" });
    return output[0].code;
  } finally {
    await bundle.close();
  }
}

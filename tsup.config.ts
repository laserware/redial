import { builtinModules } from "node:module";

import { type Options, defineConfig } from "tsup";

export default defineConfig(() => {
  const commonOptions: Options = {
    bundle: true,
    clean: true,
    // This is forwarded to Redux, just in case:
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
    },
    external: [
      "electron",
      // And also exclude Node internals from build.
      ...builtinModules.flatMap((name) => [name, `node:${name}`]),
    ],
    minify: false,
    sourcemap: true,
    tsconfig: "./tsconfig.build.json",
  };

  type Platform = Options["platform"];

  const cjs = (
    name: "main" | "preload" | "renderer",
    platform: Platform,
    entry: Record<string, string>,
  ) => ({
    ...commonOptions,
    name: `${name} (CJS)`,
    dts: true,
    entry,
    format: "cjs",
    outExtension: () => ({ js: ".cjs" }),
    platform,
  });

  const esm = (
    name: "main" | "preload" | "renderer",
    platform: Platform,
    entry: Record<string, string>,
  ) => ({
    ...commonOptions,
    name: `${name} (ESM)`,
    dts: true,
    entry,
    format: "esm",
    outExtension: () => ({ js: ".mjs" }),
    platform,
    target: "esnext",
    treeshake: true,
  });

  return [
    esm("main", "node", { main: "src/main/index.ts" }),
    esm("preload", "node", { preload: "src/sandbox/preload.ts" }),
    esm("renderer", "browser", { renderer: "src/renderer/index.ts" }),
    cjs("main", "node", { main: "src/main/index.ts" }),
    cjs("preload", "node", { preload: "src/sandbox/preload.ts" }),
    cjs("renderer", "browser", { renderer: "src/renderer/index.ts" }),
  ] as Options[];
});

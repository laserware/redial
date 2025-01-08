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

  return [
    {
      ...commonOptions,
      name: "Renderer (MJS)",
      dts: true,
      entry: { renderer: "src/renderer/index.ts" },
      format: "esm",
      outExtension: () => ({ js: ".mjs" }),
      platform: "browser",
      target: "esnext",
      treeshake: true,
    },
    {
      ...commonOptions,
      name: "Renderer (CJS)",
      dts: false,
      entry: { renderer: "src/renderer/index.ts" },
      format: "cjs",
      outExtension: () => ({ js: ".cjs" }),
      platform: "browser",
    },
    {
      ...commonOptions,
      name: "Main (ESM)",
      dts: true,
      entry: { main: "src/main/index.ts" },
      format: "esm",
      outExtension: () => ({ js: ".mjs" }),
      platform: "node",
      target: "esnext",
      treeshake: true,
    },
    {
      ...commonOptions,
      name: "Main (CJS)",
      dts: false,
      entry: { main: "src/main/index.ts" },
      format: "cjs",
      outExtension: () => ({ js: ".cjs" }),
      platform: "node",
    },
  ] as Options[];
});

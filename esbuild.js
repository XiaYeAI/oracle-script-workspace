const esbuild = require("esbuild");

const production = process.argv.includes("--production");

esbuild
  .build({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    platform: "node",
    format: "cjs",
    external: ["vscode", "oracledb"],
    outfile: "dist/extension.js",
    sourcemap: !production,
    minify: production
  })
  .catch(() => process.exit(1));

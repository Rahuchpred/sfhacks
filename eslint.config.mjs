import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Copied as is from React Bits (reactbits.dev).
    "src/components/reactbits/**",
    // Copied as is from Aceternity UI (ui.aceternity.com).
    "src/components/aceternity/**",
    ".claude/**",
  ]),
]);

export default eslintConfig;

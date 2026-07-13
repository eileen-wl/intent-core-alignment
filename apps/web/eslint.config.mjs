import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const eslintConfig = [
  {
    // Next.js-generated files: not authored, must not be linted (or
    // hand-edited to satisfy lint rules). `next/core-web-vitals`'s
    // legacy ignorePatterns don't reliably carry over through
    // FlatCompat, so this is declared explicitly.
    ignores: [".next/**", "next-env.d.ts"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;

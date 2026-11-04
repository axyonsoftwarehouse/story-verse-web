import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  // Worktrees do agente (.claude/) e artefatos locais de QA têm tsconfig próprio e confundem o parser.
  { ignores: ["dist", "node_modules", ".claude", ".dependency-resolve", "qa-runs"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-irregular-whitespace": ["error", { skipRegExps: true }],
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", caughtErrors: "none" }],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
);

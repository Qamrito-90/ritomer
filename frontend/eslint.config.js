import js from "@eslint/js";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";

export default [
  {
    ignores: ["dist", "coverage", "node_modules"]
  },
  js.configs.recommended,
  {
    files: ["e2e/shared-oidc-*.mjs"],
    languageOptions: { globals: globals.node }
  },
  {
    files: ["e2e/shared-oidc-campaign.mjs", "e2e/shared-oidc-campaign.fixture.mjs", "e2e/shared-oidc-client.mjs"],
    languageOptions: { globals: globals.browser }
  },
  {
    files: ["e2e/shared-oidc-campaign.mjs"],
    // The witness removes the private invitation before forwarding the remaining fields.
    rules: { "no-unused-vars": ["error", { ignoreRestSiblings: true }] }
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
        ...globals.node
      }
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      "no-console": ["error", { "allow": ["warn", "error"] }],
      "no-undef": "off"
    }
  }
];

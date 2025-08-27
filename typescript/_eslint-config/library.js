const { resolve } = require("node:path");

/** @type {import("eslint").FlatConfig[]} */
module.exports = [
  {
    ignores: [
      // Ignore dotfiles
      ".*.js",
      "node_modules/",
      "dist/",
      "build/",
      "out/",
      "target/",
      "*.js",
      "*.d.ts",
      "*.js.map"
    ]
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: require("@typescript-eslint/parser"),
      parserOptions: {
        project: "./tsconfig.json",
        ecmaVersion: "latest",
        sourceType: "module"
      },
      globals: {
        React: "readonly",
        JSX: "readonly",
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        setInterval: "readonly"
      }
    },
    plugins: {
      "@typescript-eslint": require("@typescript-eslint/eslint-plugin")
    },
    // rules: {
    //   ...require("@typescript-eslint/eslint-plugin").configs.recommended.rules,
    //   ...require("@typescript-eslint/eslint-plugin").configs["recommended-requiring-type-checking"].rules
    // }
    rules: {
      ...require("@typescript-eslint/eslint-plugin").configs.recommended.rules,
      // Relax some strict rules that are too aggressive
      "@typescript-eslint/no-misused-promises": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/require-await": "warn",
      // Make {} type usage a warning instead of error
      "@typescript-eslint/ban-types": "warn"
    }
  }
];

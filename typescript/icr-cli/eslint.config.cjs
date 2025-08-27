const js = require('@eslint/js');
const workspaceConfig = require('@repo/eslint-config/library.js');

module.exports = [
  js.configs.recommended,
  ...workspaceConfig,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn'
    }
  }
];

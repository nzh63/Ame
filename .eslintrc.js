const rules = {
  'no-param-reassign': 'off',
  'max-params': 'off',
  'no-invalid-this': 'off',
  '@typescript-eslint/no-invalid-this': 'off',
  '@typescript-eslint/member-ordering': [
    'error',
    {
      default: ['field', 'constructor', 'static-method', 'instance-method', 'method'],
    },
  ],
  '@typescript-eslint/consistent-type-assertions': [
    'error',
    { assertionStyle: 'as', objectLiteralTypeAssertions: 'allow' },
  ],
  '@typescript-eslint/no-unused-vars': 'off',
  'vue/custom-event-name-casing': ['error', 'kebab-case'],
};

module.exports = {
  root: true,
  env: {
    node: true,
  },
  rules,
  extends: ['alloy', 'alloy/typescript'],
  overrides: [
    {
      files: ['./test/**/*'],
      rules: {
        'no-unused-expressions': 'off',
        '@typescript-eslint/no-unused-expressions': 'off',
        'max-nested-callbacks': ['error', 6],
      },
    },
    {
      files: ['**/*.vue'],
      extends: ['alloy', 'alloy/typescript', 'alloy/vue'],
      parserOptions: {
        ecmaVersion: 2020,
        parser: {
          ts: '@typescript-eslint/parser',
          mts: '@typescript-eslint/parser',
          tsx: '@typescript-eslint/parser',
        },
      },
      rules,
    },
  ],
};

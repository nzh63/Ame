module.exports = {
  root: true,
  env: {
    node: true,
  },
  parserOptions: {
    ecmaVersion: 2020,
    parser: {
      ts: '@typescript-eslint/parser',
      mts: '@typescript-eslint/parser',
      tsx: '@typescript-eslint/parser',
    },
  },
  rules: {
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
    'vue/custom-event-name-casing': ['error', 'kebab-case'],
  },
  extends: ['alloy', 'alloy/typescript', 'alloy/vue'],
  overrides: [
    {
      files: ['./test/**/*'],
      rules: {
        'no-unused-expressions': 'off',
        '@typescript-eslint/no-unused-expressions': 'off',
      },
    },
  ],
};

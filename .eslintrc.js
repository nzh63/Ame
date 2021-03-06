module.exports = {
    root: true,
    env: {
        node: true
    },
    parserOptions: {
        ecmaVersion: 2020
    },
    rules: {
        semi: ['warn', 'always'],
        indent: ['error', 4],
        'no-undef': 'off',
        'no-use-before-define': 'off',
        'space-before-function-paren': ['error', {
            anonymous: 'never',
            named: 'never',
            asyncArrow: 'always'
        }],
        'n/no-callback-literal': 'off',
        '@typescript-eslint/semi': ['warn', 'always'],
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': ['error', { args: 'none' }],
        '@typescript-eslint/no-empty-function': 'off',
        'vue/no-v-model-argument': 'off',
        'vue/multi-word-component-names': 'off'
    },
    extends: [
        'plugin:vue/vue3-recommended',
        '@vue/standard',
        '@vue/typescript/recommended'
    ]
};

// @ts-check

import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config({
    extends: [js.configs.recommended, ...tseslint.configs.recommended],

    files: ['**/*.ts'],

    rules: {
        '@typescript-eslint/no-unused-vars': [
            'error',
            {
                args: 'none',
            },
        ],
    },
});

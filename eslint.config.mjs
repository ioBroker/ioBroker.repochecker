import config from '@iobroker/eslint-config';

export default [
    ...config,
    {
        languageOptions: {
            parserOptions: {
/*                 allowDefaultProject: {
                    allow: ['*.js', '*.mjs'],
                },
 */                tsconfigRootDir: import.meta.dirname,
                project: './tsconfig.json',
                // projectService: true,
            },
        },
    },
    {
        // disable temporary the rule 'jsdoc/require-param' and enable 'jsdoc/require-jsdoc'
        rules: {
            'jsdoc/require-jsdoc': 'off',
            'jsdoc/require-param': 'off',
        },
    },
    {
        ignores: [
            'build-backend/**/*',
            'frontend/**/*',        // TODO - changes must be confirmed / reviewed by BF
            'doc/**/*',             // TODO - doc scripts must be reviewed anyway
            'scripts/**/*',         // TODO - do not change older scripts for now

            // exclude config files as they cause an error from parser
            'eslint.config.mjs',
            'prettier.config.mjs',
        ],
    },
];

module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    testMatch: ['**/*.test.ts', '**/*.test.js', '**/*.test.mjs'],
    transform: {
        '^.+\\.ts$': ['ts-jest', {
            tsconfig: {
                module: 'commonjs',
                esModuleInterop: true,
                allowSyntheticDefaultImports: true
            }
        }],
        '^.+\\.m?js$': 'babel-jest'
    },
    transformIgnorePatterns: [
        'node_modules/(?!(supertest)/)'
    ],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node', 'mjs'],
    collectCoverageFrom: [
        'src/**/*.{js,mjs,ts}',
        '!src/**/*.d.ts'
    ]
};

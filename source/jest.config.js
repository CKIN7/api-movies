/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  maxWorkers: 1,
  // BD de tests: globalSetup la recrea desde cero (db/schema.sql) antes de
  // que arranquen los workers, y setTestDbEnv redirige DB_NAME de la app a
  // esa BD dentro de cada worker. Asi los tests jamas tocan moviesdb.
  globalSetup: '<rootDir>/__tests__/helpers/globalSetup.js',
  setupFiles: ['<rootDir>/__tests__/helpers/setTestDbEnv.js'],
  setupFilesAfterEnv: ['<rootDir>/__tests__/helpers/closeDb.js']
}

/** @type {import('jest').Config} */
module.exports = {
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.[jt]s?(x)',
    '<rootDir>/tests/integration/**/*.test.[jt]s?(x)',
  ],
  preset: 'ts-jest',
}

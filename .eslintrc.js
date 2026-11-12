module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    'eslint:recommended',
    'prettier'
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  rules: {
    // Add any specific rules here
  },
  overrides: [
    {
      files: ['server/**/*.js'],
      env: {
        node: true,
        browser: false,
      },
    },
  ],
};

module.exports = {
  extends: 'airbnb-base',
  env: {
    node: true,
    es6: true,
    amd: true,
    commonjs: true,
  },
  rules: {
    'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
    'no-use-before-define': ['error', { functions: false, classes: true }],
  }
};

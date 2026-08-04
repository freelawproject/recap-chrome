const browserGlobals = {
  Atomics: 'readonly',
  Blob: 'readonly',
  CustomEvent: 'readonly',
  DOMParser: 'readonly',
  FileReader: 'readonly',
  FormData: 'readonly',
  Headers: 'readonly',
  HTMLAnchorElement: 'readonly',
  MutationObserver: 'readonly',
  Request: 'readonly',
  Response: 'readonly',
  SharedArrayBuffer: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  browser: 'readonly',
  chrome: 'readonly',
  console: 'readonly',
  document: 'readonly',
  fetch: 'readonly',
  history: 'readonly',
  location: 'readonly',
  navigator: 'readonly',
  self: 'readonly',
  window: 'readonly',
};

const jasmineGlobals = {
  afterAll: 'readonly',
  afterEach: 'readonly',
  beforeAll: 'readonly',
  beforeEach: 'readonly',
  describe: 'readonly',
  expect: 'readonly',
  fail: 'readonly',
  it: 'readonly',
  jasmine: 'readonly',
  pending: 'readonly',
  spyOn: 'readonly',
  spyOnProperty: 'readonly',
  xdescribe: 'readonly',
  xit: 'readonly',
};

const rules = {
  indent: ['error', 2, { SwitchCase: 1 }],
  'linebreak-style': ['error', 'unix'],
  'multiline-ternary': ['error', 'always-multiline'],
  quotes: ['error', 'single'],
  semi: ['error', 'always'],
};

module.exports = [
  {
    ignores: ['coverage/**', 'node_modules/**', 'src/assets/js/**', 'test/Blob.js', 'test/mock-ajax.js'],
  },
  {
    files: ['src/**/*.js', 'spec/**/*.js', 'test/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: browserGlobals,
    },
    rules,
  },
  {
    files: ['spec/**/*.js'],
    languageOptions: {
      globals: {
        ...browserGlobals,
        ...jasmineGlobals,
      },
    },
    rules,
  },
  {
    files: ['test/mock-file-saver.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: browserGlobals,
    },
    rules,
  },
];

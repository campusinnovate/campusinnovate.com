const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToString } = require('react-dom/server');

function loadProvider(document) {
  const context = {
    exports: {},
    document,
    require(name) {
      if (name === 'react' || name === 'react/jsx-runtime' || name === 'react-dom') return require(name);
      // Effects and toast animations do not execute during initial rendering.
      if (name === 'framer-motion') return { AnimatePresence: ({ children }) => children };
      return {};
    },
  };
  const source = fs.readFileSync('src/components/ruang-kawan/RuangKawanNotificationProvider.tsx', 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText, context);
  return context.exports.default;
}

test('notifications render identical empty markup before effects on server and browser', () => {
  const server = renderToString(React.createElement(loadProvider(undefined)));
  // A DOM-like portal target exposes the former browser-only initial portal.
  const browser = renderToString(React.createElement(loadProvider({ body: { nodeType: 1 } })));
  assert.equal(server, '');
  assert.equal(browser, server);
});

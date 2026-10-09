const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const layout = fs.readFileSync('src/app/layout.tsx', 'utf8');
const conversionScript = layout.match(/id="google-ads-whatsapp-conversion"[\s\S]*?\{`([\s\S]*?)`\}/)[1];

test('WhatsApp conversion only fires once per delegated click, including nested icons', () => {
  let click;
  const events = [];
  class Element {
    constructor(link) { this.link = link; }
    closest(selector) {
      assert.equal(selector, 'a[href*="wa.me/6285882514394"]');
      return this.link;
    }
  }
  vm.runInNewContext(conversionScript, {
    Element,
    document: { addEventListener: (name, handler) => { assert.equal(name, 'click'); click = handler; } },
    gtag: (...args) => events.push(args),
  });
  assert.equal(events.length, 0, 'loading the page must not be a conversion');
  click({ target: {} });
  click({ target: new Element(null) });
  assert.equal(events.length, 0, 'non-WhatsApp clicks must not be conversions');
  for (const placement of ['header', 'hero', 'portfolio', 'closing', 'footer', 'sticky-mobile', 'after-logos', 'floating-desktop']) {
    click({ target: new Element({ dataset: { service: 'event-management', ctaPlacement: placement } }) });
    const event = events.at(-1);
    assert.equal(event[0], 'event');
    assert.equal(event[1], 'conversion');
    assert.equal(event[2].send_to, 'AW-18473450758/iaLBCN-i35AdEIb66ehE');
    assert.equal(event[2].event_label, placement);
  }
  assert.equal(events.length, 8);
});

test('legacy event URLs preserve all ad attribution parameters when redirecting', () => {
  const source = fs.readFileSync('src/components/public/Homepage.tsx', 'utf8');
  const handler = source.match(/const syncFromHash = \(\) => \{([\s\S]*?)\n    \};/)[1];
  for (const pathname of ['/', '/home/']) {
    let redirected;
    const search = '?utm_source=google&utm_campaign=event%20campus&gclid=test&gbraid=abc&wbraid=def';
    vm.runInNewContext(require('typescript').transpile(`(() => {${handler}})()`), {
      window: { location: { pathname, hash: '#event-experience', search, replace: (url) => { redirected = url; } } },
    });
    assert.equal(redirected, '/event-management/' + search);
  }
});

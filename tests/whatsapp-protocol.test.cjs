const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { webcrypto, createHmac } = require('node:crypto');
const vm = require('node:vm');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('supabase/functions/_shared/whatsapp.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: exportsObject, crypto: webcrypto, TextEncoder, Uint8Array });
test('Phone normalization deduplicates Indonesian formats and rejects malformed numbers', () => {
 for (const value of ['08123456789','+628123456789','628123456789']) assert.equal(exportsObject.normalizePhone(value),'628123456789');
 assert.throws(()=>exportsObject.normalizePhone('hello08123456789'));
});
test('Webhook HMAC checks the raw body and fails closed', async () => {
 const raw='{"entry":[]}', secret='test-secret';
 const sig='sha256='+createHmac('sha256',secret).update(raw).digest('hex');
 assert.equal(await exportsObject.verifySignature(raw,sig,secret),true);
 assert.equal(await exportsObject.verifySignature(raw+' ',sig,secret),false);
 assert.equal(await exportsObject.verifySignature(raw,null,secret),false);
 assert.equal(await exportsObject.verifySignature(raw,sig,''),false);
});
test('Text, button and unsupported media produce safe display content', () => {
 assert.equal(exportsObject.messageContent({type:'text',text:{body:'Halo'}}),'Halo');
 assert.equal(exportsObject.messageContent({type:'interactive',interactive:{button_reply:{title:'Ya'}}}),'Ya');
 assert.equal(exportsObject.messageContent({type:'image',image:{caption:'Brief'}}),'[image] Brief');
});

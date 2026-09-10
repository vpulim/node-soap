'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const { open_wsdl } = require('../lib/wsdl');

const wsdlXml = fs.readFileSync(path.join(__dirname, '/wsdl/sequence_models.wsdl'), 'utf8');

function posOf(xml, localName) {
  const re = new RegExp(`<\\s*(?:[A-Za-z_][\\w.-]*:)?${localName}(?=[\\s>/])`);
  const m = re.exec(xml);
  return m ? m.index : -1;
}

function assertOrder(xml, names) {
  let prev = -1;
  for (const n of names) {
    const p = posOf(xml, n);
    assert.ok(p >= 0, `Expected <${n}> in:\n${xml}`);
    assert.ok(p > prev, `Expected <${n}> after previous in order ${names.join(' → ')}.\n${xml}`);
    prev = p;
  }
}

describe('WSDL sequence ordering (sequence / choice / group)', function () {
  let wsdl;

  before(function (done) {
    open_wsdl(wsdlXml, {}, (err, w) => {
      if (err) return done(err);
      wsdl = w;
      done();
    });
  });

  function serialize(typeName, payload, wrapperName) {
    return wsdl.objectToDocumentXML(wrapperName || typeName.replace(/Type$/, ''), payload, 'tns', 'urn:seq', typeName);
  }

  it('respects <sequence> + same-namespace <group ref> order', function () {
    const xml = serialize('PersonType', { age: 7, last: 'Doe', first: 'Jane' }, 'Person');
    assertOrder(xml, ['first', 'last', 'age']);
  });

  it('keeps a single <choice> alternative in the correct slot', function () {
    const xml = serialize('ChoiceMiddleType', { b: 'B', y: 'Y', a: 'A' }, 'ChoiceMiddle');
    assertOrder(xml, ['a', 'y', 'b']);
  });

  it('when (invalidly) providing two <choice> alternatives, keeps them adjacent in the slot', function () {
    const xml = serialize('ChoiceMiddleType', { a: 'A', y: 'Y', x: 'X', b: 'B' }, 'ChoiceMiddle');
    const a = posOf(xml, 'a');
    const x = posOf(xml, 'x');
    const y = posOf(xml, 'y');
    const b = posOf(xml, 'b');

    assert.ok(a >= 0 && x >= 0 && y >= 0 && b >= 0, 'expected tags missing');

    assert.ok(a < x && x < b, 'x must be between a and b');
    assert.ok(a < y && y < b, 'y must be between a and b');
  });

  it('does NOT reorder members of <all>', function () {
    const xml = serialize('WithAllType', { n: 'N', m: 'M' }, 'WithAll');
    assert.ok(posOf(xml, 'n') < posOf(xml, 'm'), 'expected input order n then m');
  });

  it('handles a nested <choice> whose alternative is a <group ref>', function () {
    const xml = serialize('NestedChoiceType', { post: 'Q', first: 'Jane', pre: 'P', last: 'Doe' }, 'NestedChoice');
    const pre = posOf(xml, 'pre');
    const first = posOf(xml, 'first');
    const last = posOf(xml, 'last');
    const post = posOf(xml, 'post');

    assert.ok(pre >= 0 && first >= 0 && last >= 0 && post >= 0, 'expected tags missing');
    assert.ok(pre < first && first < post, 'first should be between pre and post');
    assert.ok(pre < last && last < post, 'last should be between pre and post');
  });

  it('puts unknown properties (not in schema) at the end', function () {
    const xml = serialize('UnknownSlotType', { b: 'B', z: 'Z', a: 'A' }, 'UnknownSlot');
    assertOrder(xml, ['a', 'b']);
    const z = posOf(xml, 'z');
    const b = posOf(xml, 'b');
    assert.ok(z > b, 'unknown property z should come after known sequence members');
  });

  it('respects order when a <group ref> points to ANOTHER namespace', function () {
    const xml = serialize('CrossNSGroupType', { age: 11, city: 'Roma', id: '42', street: 'Via' }, 'CrossNSGroup');
    assertOrder(xml, ['id', 'street', 'city', 'age']);
  });
});

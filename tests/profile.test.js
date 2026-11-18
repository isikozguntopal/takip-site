import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displayName } from '../js/profile.js';

test('displayName puts the title before the name', () => {
  assert.equal(displayName({ title: 'Prof. Dr.', name: 'Ayşe Yılmaz' }), 'Prof. Dr. Ayşe Yılmaz');
  assert.equal(displayName({ title: '  Erg. ', name: ' Ayşe  Yılmaz ' }), 'Erg. Ayşe Yılmaz');
});

test('displayName is empty without a name, even with a title', () => {
  assert.equal(displayName({ title: 'Dr.', name: '  ' }), '');
  assert.equal(displayName({}), '');
});

test('displayName works without a title', () => {
  assert.equal(displayName({ name: 'Ayşe Yılmaz' }), 'Ayşe Yılmaz');
});

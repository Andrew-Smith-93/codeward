import assert from 'node:assert/strict';
import { describe, expect, it } from './node-test.js';

describe('node:test expect adapter', () => {
  it('does not treat matcher runtime errors as a failed assertion under .not', () => {
    assert.throws(() => expect({}).not.toContain('needle'), TypeError);
  });
});

describe('throw matcher messages', () => {
  it('requires matching string text instead of treating it as an assertion label', () => {
    expect(() => { throw new Error('expected detail'); }).toThrow('expected');
    assert.throws(() => expect(() => { throw new Error('actual'); }).toThrow('expected'));
    expect(() => { throw new Error('actual'); }).not.toThrow('expected');
  });
  it('rejects mismatched async error messages', async () => {
    await assert.rejects(expect(Promise.reject(new Error('actual'))).rejects.toThrow('expected'));
    await expect(Promise.reject(new Error('expected detail'))).rejects.toThrow('expected');
  });
});

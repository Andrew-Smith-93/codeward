import assert from 'node:assert/strict';
import { AssertionError } from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';

type Matcher = (expected?: unknown) => void;
type Matchers = Record<string, Matcher> & { not: Matchers };
type Expectation = Matchers & { rejects: { toThrow(expected?: string | RegExp): Promise<void> } };

function errorMatches(expected: unknown): ((error: unknown) => boolean) | undefined {
  if (expected === undefined) return undefined;
  if (typeof expected === 'string') return (error) => error instanceof Error && error.message.includes(expected);
  if (expected instanceof RegExp) return (error) => {
    expected.lastIndex = 0;
    return error instanceof Error && expected.test(error.message);
  };
  throw new TypeError('toThrow expects a string, RegExp, or no argument');
}

function createMatchers(actual: unknown, negate = false): Matchers {
  const check = (assertion: () => void) => {
    if (!negate) return assertion();
    try {
      assertion();
    } catch (error) {
      if (error instanceof AssertionError) return;
      throw error;
    }
    throw new AssertionError({ message: 'Expected the assertion to fail when using .not' });
  };
  const matchers: Record<string, Matcher> = {
    toBe: (expected) => check(() => assert.equal(actual, expected)),
    toEqual: (expected) => check(() => assert.deepEqual(actual, expected)),
    toContain: (expected) => check(() => assert.ok((actual as { includes(value: unknown): boolean }).includes(expected))),
    toHaveLength: (expected) => check(() => assert.equal((actual as { length: number }).length, expected)),
    toBeDefined: () => check(() => assert.notEqual(actual, undefined)),
    toBeGreaterThan: (expected) => check(() => assert.ok((actual as number) > (expected as number))),
    toBeGreaterThanOrEqual: (expected) => check(() => assert.ok((actual as number) >= (expected as number))),
    toThrow: (expected) => check(() => assert.throws(actual as () => unknown, errorMatches(expected))),
  };
  Object.defineProperty(matchers, 'not', { get: () => createMatchers(actual, !negate) });
  return matchers as Matchers;
}

export { afterEach, beforeEach, describe, it };
export const expect = (actual: unknown): Expectation => Object.assign(createMatchers(actual), {
  rejects: {
    toThrow: async (expected?: RegExp) => {
      await assert.rejects(actual as Promise<unknown>, errorMatches(expected));
    },
  },
});

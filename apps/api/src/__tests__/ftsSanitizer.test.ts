import { describe, test, expect } from 'vitest';
import { sanitizeFtsQuery } from '../db/ftsSanitizer';

describe('sanitizeFtsQuery', () => {
  test('wraps bareword AND as a phrase match', () => {
    expect(sanitizeFtsQuery('AND')).toBe('"AND"*');
  });

  test('strips trailing colon so `foo:` does not hit column syntax', () => {
    expect(sanitizeFtsQuery('foo:')).toBe('"foo"*');
  });

  test('strips quote and paren from `"a)b`', () => {
    expect(sanitizeFtsQuery('"a)b')).toBe('"ab"*');
  });

  test('neutralises NEAR(x y) by tokenising and stripping parens', () => {
    expect(sanitizeFtsQuery('NEAR(x y)')).toBe('"NEARx" "y"*');
  });

  test('returns null for empty string', () => {
    expect(sanitizeFtsQuery('')).toBeNull();
  });

  test('returns null for whitespace-only input', () => {
    expect(sanitizeFtsQuery('    \t  \n')).toBeNull();
  });

  test('quotes each token and prefixes only the last for `harry potter`', () => {
    expect(sanitizeFtsQuery('harry potter')).toBe('"harry" "potter"*');
  });

  test('passes Unicode characters through unmodified', () => {
    expect(sanitizeFtsQuery('naïve')).toBe('"naïve"*');
  });

  test('returns null when input contains only strippable characters', () => {
    expect(sanitizeFtsQuery('*():"\'-')).toBeNull();
  });

  test('single token gets a prefix star', () => {
    expect(sanitizeFtsQuery('foo')).toBe('"foo"*');
  });

  test('three tokens put the star only on the last', () => {
    expect(sanitizeFtsQuery('red green blue')).toBe('"red" "green" "blue"*');
  });

  test('mind-list all-metachar token is dropped without breaking neighbours', () => {
    expect(sanitizeFtsQuery('foo *** bar')).toBe('"foo" "bar"*');
  });

  test('strips leading hyphen so bareword NOT is defused', () => {
    expect(sanitizeFtsQuery('-cat')).toBe('"cat"*');
  });
});

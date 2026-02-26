import { describe, it, expect } from "vitest";
import { clampPage, computeScale, zoomOutStep, zoomInStep, parseStoredPage } from "../pdfUtils";

describe('clampPage', () => {
  it('returns 1 for page 0', () => expect(clampPage(0, 100)).toBe(1));
  it('returns 1 for negative page', () => expect(clampPage(-5, 100)).toBe(1));
  it('clamps to total when beyond end', () => expect(clampPage(101, 100)).toBe(100));
  it('passes through valid page', () => expect(clampPage(42, 100)).toBe(42));
  it('floors fractional pages', () => expect(clampPage(3.9, 100)).toBe(3));
});

describe('computeScale', () => {
  it('fit-width divides container width by page width', () => {
    expect(computeScale('fit-width', 800, 1000, 400, 600, 1)).toBe(2);
  });

  it('fit-page is constrained by the tighter dimension', () => {
    // width ratio: 800/400 = 2, height ratio: 1000/600 = 1.666...
    expect(computeScale('fit-page', 800, 1000, 400, 600, 1)).toBeCloseTo(1.666, 2);
  });

  it('fit-page constrained by width when page is wide', () => {
    // width ration: 400/800 = 0.5, height ratio: 1000/200 = 5 -> min is 0.5
    expect(computeScale('fit-page', 400, 1000, 800, 200, 1)).toBe(0.5);
  });

  it('custom returns the provided scale unchanged', () => {
    expect(computeScale('custom', 800, 1000, 400, 600, 1.25)).toBe(1.25);
  });
});

describe('zoomOutStep', () => {
  it('returns null at minimum zoom', () => expect(zoomOutStep(0.5)).toBeNull());
  it('returns previous step from 1.0', () => expect(zoomOutStep(1.0)).toBe(0.75));
  it('handles scale between steps', () => expect(zoomOutStep(1.1)).toBe(1.0));
  it('returns largest step smaller than current', () => expect(zoomOutStep(2.0)).toBe(1.5));
});


describe('zoomInStep', () => {
  it('returns null at maximum zoom', () => expect(zoomInStep(2.0)).toBeNull());
  it('returns next step from 1.0', () => expect(zoomInStep(1.0)).toBe(1.25));
  it('handles scale between steps', () => expect(zoomInStep(0.9)).toBe(1.0));
  it('returns smallest step larger than current', () => expect(zoomInStep(0.5)).toBe(0.75));
});

describe('parseStoredPage', () => {
  it('returns 1 for null', () => expect(parseStoredPage(null)).toBe(1));
  it('returns 1 for empty string', () => expect(parseStoredPage('')).toBe(1));
  it('returns 1 for non-numeric string', () => expect(parseStoredPage('epubcfi(/6/4)')).toBe(1));
  it('parses valid page number', () => expect(parseStoredPage('42')).toBe(42));
  it('returns 1 for page 0', () => expect(parseStoredPage('0')).toBe(1));
  it('returns 1 for negative', () => expect(parseStoredPage('-3')).toBe(1));
});

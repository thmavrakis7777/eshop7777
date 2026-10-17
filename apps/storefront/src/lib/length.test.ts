import { describe, expect, it } from "vitest";
import { formatMetres, maxSteps, metresToSteps, minSteps, stepPriceCents, stepsToMetres } from "./length";

const hose = { stepCm: 50, minCm: 100, maxCm: 2000 };

describe("length products — steps and metres", () => {
  it("counts 0,5 μ steps", () => {
    expect(stepsToMetres(5, 50)).toBe(2.5);
    expect(formatMetres(5, 50)).toBe("2,5 μ");
    expect(formatMetres(2, 50)).toBe("1 μ");
    expect(formatMetres(40, 50)).toBe("20 μ");
  });

  it("reads typed metres with a comma or a dot", () => {
    expect(metresToSteps("2,5", 50)).toBe(5);
    expect(metresToSteps("2.5", 50)).toBe(5);
    expect(metresToSteps(" 3 ", 50)).toBe(6);
    expect(metresToSteps(0.5, 50)).toBe(1);
  });

  it("refuses a length that isn't a whole number of steps, or isn't a number", () => {
    expect(metresToSteps("2,3", 50)).toBeNull();
    expect(metresToSteps("abc", 50)).toBeNull();
    expect(metresToSteps("", 50)).toBe(0);
  });

  it("derives the limits per order line", () => {
    expect(minSteps(hose)).toBe(2);
    expect(maxSteps(hose)).toBe(40);
  });

  it("splits the price per metre into whole-cent steps", () => {
    expect(stepPriceCents(300, 50)).toBe(150);
    // 2,5 μ of 3,00 €/μ: 5 steps × 1,50 € = 7,50 € — the owner's example.
    expect(5 * stepPriceCents(300, 50)!).toBe(750);
    expect(stepPriceCents(299, 50)).toBeNull();
    expect(stepPriceCents(300, 100)).toBe(300);
  });
});

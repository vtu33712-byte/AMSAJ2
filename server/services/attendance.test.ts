import { describe, expect, it } from "vitest";
import { attendanceBand, attendancePercent, classesMissable, classesNeeded, projectedPercent, semesterScenarios } from "./attendance";

describe("attendance intelligence", () => {
  it("returns no percentage when there are no records", () => expect(attendancePercent(0, 0)).toBeNull());
  it("computes the requested percentage formula", () => expect(attendancePercent(31, 45)).toBeCloseTo(68.8889, 3));
  it("rejects impossible present/total counts", () => expect(() => attendancePercent(4, 3)).toThrow());

  it("calculates minimum consecutive classes to reach threshold", () => {
    expect(classesNeeded(31, 14, 75)).toBe(11);
    expect(classesNeeded(8, 2, 75)).toBe(0);
    expect(classesNeeded(5, 5, 100)).toBeNull();
    expect(classesNeeded(0, 0, null)).toBeNull();
  });

  it("calculates missable classes only while currently eligible", () => {
    expect(classesMissable(8, 2, 75)).toBe(0);
    expect(classesMissable(9, 1, 75)).toBe(2);
    expect(classesMissable(3, 1, 0)).toBeNull();
    expect(classesMissable(6, 4, 75)).toBe(0);
  });

  it("projects only supplied future sessions", () => {
    expect(projectedPercent(31, 14, 11, 0)).toBeCloseTo(75, 8);
    expect(projectedPercent(31, 14, 12, 0)).toBeCloseTo(75.44, 2);
  });

  it("uses configurable risk bands and marks missing rules unconfigured", () => {
    expect(attendanceBand(null, 75)).toBe("UNCONFIGURED");
    expect(attendanceBand(74, 75)).toBe("SHORTAGE");
    expect(attendanceBand(77, 70, 80, 75)).toBe("WATCH");
    expect(attendanceBand(74, 70, 80, 75)).toBe("AT RISK");
    expect(attendanceBand(82, 75, 80, 75)).toBe("SAFE");
  });

  it("creates the four requested semester scenarios", () => {
    const scenarios = semesterScenarios(31, 14, 12, 4, 2);
    expect(scenarios.map(s => s.name)).toEqual([
      "Attend every remaining class",
      "Miss 1 class per week",
      "Miss 2 classes per week",
      "Attend regular + eligible extra classes",
    ]);
    expect(scenarios[0]?.projectedPercent).toBeCloseTo((43 / 57) * 100, 8);
    expect(scenarios[3]?.attend).toBe(14);
  });

  it("counts one or two missed sessions in every represented future week, including a partial final week", () => {
    const scenarios = semesterScenarios(40, 5, 5, 3, 0, 2);
    expect(scenarios[1]?.miss).toBe(2);
    expect(scenarios[1]?.attend).toBe(3);
    expect(scenarios[2]?.miss).toBe(4);
    expect(scenarios[2]?.attend).toBe(1);
  });
});

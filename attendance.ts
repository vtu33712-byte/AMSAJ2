export type AttendanceBand = "SAFE" | "WATCH" | "AT RISK" | "SHORTAGE" | "UNCONFIGURED";

export type AttendanceSnapshot = {
  present: number;
  absent: number;
  requiredPercent: number | null;
  safePercent?: number | null;
  watchPercent?: number | null;
};

const finiteNonNegative = (n: number, label: string) => {
  if (!Number.isFinite(n) || n < 0) throw new Error(`${label} must be a non-negative number`);
};

export function attendancePercent(present: number, total: number): number | null {
  finiteNonNegative(present, "Present classes");
  finiteNonNegative(total, "Total classes");
  if (present > total) throw new Error("Present classes cannot exceed total classes");
  return total === 0 ? null : (present / total) * 100;
}

/** Minimum additional consecutive attendances required to meet a configured percentage. */
export function classesNeeded(present: number, absent: number, requiredPercent: number | null): number | null {
  finiteNonNegative(present, "Present classes");
  finiteNonNegative(absent, "Absent classes");
  if (!Number.isInteger(present) || !Number.isInteger(absent)) throw new Error("Class counts must be whole numbers");
  if (requiredPercent === null || !Number.isFinite(requiredPercent) || requiredPercent < 0 || requiredPercent > 100) return null;
  const total = present + absent;
  const current = attendancePercent(present, total);
  if (current !== null && current + 1e-9 >= requiredPercent) return 0;
  if (requiredPercent === 100) return absent === 0 ? 0 : null;
  if (requiredPercent === 0) return 0;
  const ratio = requiredPercent / 100;
  return Math.max(0, Math.ceil((ratio * total - present) / (1 - ratio) - 1e-10));
}

/** Maximum additional absences while remaining at/above the configured threshold; null means unbounded/unavailable. */
export function classesMissable(present: number, absent: number, requiredPercent: number | null): number | null {
  finiteNonNegative(present, "Present classes");
  finiteNonNegative(absent, "Absent classes");
  if (requiredPercent === null || !Number.isFinite(requiredPercent) || requiredPercent < 0 || requiredPercent > 100) return null;
  const total = present + absent;
  const current = attendancePercent(present, total);
  if (current !== null && current + 1e-9 < requiredPercent) return 0;
  if (requiredPercent === 0) return null;
  if (present === 0) return 0;
  return Math.max(0, Math.floor((present * 100) / requiredPercent - total + 1e-9));
}

export function projectedPercent(
  present: number,
  absent: number,
  futureAttend: number,
  futureMiss: number
): number | null {
  for (const [value, label] of [[present, "Present"], [absent, "Absent"], [futureAttend, "Future attendances"], [futureMiss, "Future absences"]] as const) {
    finiteNonNegative(value, label);
    if (!Number.isInteger(value)) throw new Error(`${label} must be a whole number`);
  }
  return attendancePercent(present + futureAttend, present + absent + futureAttend + futureMiss);
}

export function attendanceBand(
  currentPercent: number | null,
  requiredPercent: number | null,
  safePercent: number | null = 80,
  watchPercent: number | null = 75
): AttendanceBand {
  if (currentPercent === null || requiredPercent === null) return "UNCONFIGURED";
  if (currentPercent < requiredPercent) return "SHORTAGE";
  if (safePercent !== null && currentPercent >= safePercent) return "SAFE";
  if (watchPercent !== null && currentPercent >= watchPercent) return "WATCH";
  return "AT RISK";
}

export type SemesterScenario = { name: string; attend: number; miss: number; projectedPercent: number | null };

export function semesterScenarios(
  present: number,
  absent: number,
  remainingClasses: number,
  classesPerWeek: number,
  eligibleExtraClasses = 0,
  weeksWithClasses?: number
): SemesterScenario[] {
  for (const [value, label] of [[remainingClasses, "Remaining classes"], [classesPerWeek, "Classes per week"], [eligibleExtraClasses, "Eligible extra classes"]] as const) {
    finiteNonNegative(value, label);
    if (!Number.isInteger(value)) throw new Error(`${label} must be a whole number`);
  }
  const activeWeeks = weeksWithClasses ?? Math.ceil(remainingClasses / Math.max(classesPerWeek, 1));
  finiteNonNegative(activeWeeks, "Weeks with scheduled classes");
  if (!Number.isInteger(activeWeeks)) throw new Error("Weeks with scheduled classes must be a whole number");
  const missPerWeek = (n: number) => Math.min(remainingClasses, activeWeeks * n);
  const missedOne = missPerWeek(1);
  const missedTwo = missPerWeek(2);
  const values = [
    { name: "Attend every remaining class", attend: remainingClasses, miss: 0 },
    { name: "Miss 1 class per week", attend: remainingClasses - missedOne, miss: missedOne },
    { name: "Miss 2 classes per week", attend: remainingClasses - missedTwo, miss: missedTwo },
    { name: "Attend regular + eligible extra classes", attend: remainingClasses + eligibleExtraClasses, miss: 0 },
  ];
  return values.map(s => ({ ...s, projectedPercent: projectedPercent(present, absent, s.attend, s.miss) }));
}

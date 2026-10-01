import { and, asc, desc, eq, gte, isNull, lt } from "drizzle-orm";
import { assignments, attendance, credits, examSchedule, extraClasses, marks, results, students, subjects, timetable } from "../../drizzle/schema";
import { getDb } from "../db";
import { attendanceBand, attendancePercent, classesMissable, classesNeeded, projectedPercent, semesterScenarios } from "./attendance";

export type ImportPayload = {
  student?: Record<string, unknown>;
  subjects?: Array<Record<string, unknown>>;
  attendance?: Array<Record<string, unknown>>;
  extraClasses?: Array<Record<string, unknown>>;
  timetable?: Array<Record<string, unknown>>;
  marks?: Array<Record<string, unknown>>;
  results?: Array<Record<string, unknown>>;
  credits?: Array<Record<string, unknown>>;
  assignments?: Array<Record<string, unknown>>;
  exams?: Array<Record<string, unknown>>;
};

class ImportValidationError extends Error {}

const text = (value: unknown, max = 240): string | null => {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const v = String(value).trim();
  if (v.length > max) throw new ImportValidationError(`A text value exceeds the ${max}-character limit.`);
  return v;
};
const number = (value: unknown): number | null => {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
};
const date = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
};
const calendarDate = (value: unknown): Date | null => {
  const parsed = date(value);
  return parsed ? new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate())) : null;
};
const yes = (value: unknown) => value === true || value === 1 || ["true", "yes", "1", "y"].includes(String(value ?? "").trim().toLowerCase());
const decimalString = (value: unknown, max: number) => {
  const n = number(value);
  if (n === null) {
    if (value !== undefined && value !== null && String(value).trim() !== "") throw new ImportValidationError("A numeric value must be valid.");
    return null;
  }
  if (n < 0 || n > max) throw new ImportValidationError(`Numeric values must be between 0 and ${max}.`);
  return n.toFixed(2);
};
const safeStatus = (value: unknown): "present" | "absent" | null => {
  const status = String(value ?? "").trim().toLowerCase();
  if (["present", "p", "attended"].includes(status)) return "present";
  if (["absent", "a", "missed"].includes(status)) return "absent";
  return null;
};

export async function getStudentProfile(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [row] = await db.select().from(students).where(eq(students.userId, userId)).limit(1);
  return row ?? null;
}

export async function getSubjectRows(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.select().from(subjects).where(eq(subjects.userId, userId)).orderBy(asc(subjects.name));
}

export async function getAttendanceAnalysis(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [profile, courseRows, sessions, extras, scheduled] = await Promise.all([
    getStudentProfile(userId),
    getSubjectRows(userId),
    db.select().from(attendance).where(eq(attendance.userId, userId)),
    db.select().from(extraClasses).where(eq(extraClasses.userId, userId)),
    db.select().from(timetable).where(eq(timetable.userId, userId)),
  ]);
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const futureRows = scheduled.filter(row => row.classDate.getTime() >= todayUtc.getTime());
  const futureBySubject = new Map<number, number>();
  const weeksBySubject = new Map<number, Set<string>>();
  for (const item of futureRows) {
    futureBySubject.set(item.subjectId, (futureBySubject.get(item.subjectId) ?? 0) + 1);
    const monday = new Date(Date.UTC(item.classDate.getUTCFullYear(), item.classDate.getUTCMonth(), item.classDate.getUTCDate()));
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    const week = monday.toISOString().slice(0, 10);
    const weeks = weeksBySubject.get(item.subjectId) ?? new Set<string>();
    weeks.add(week);
    weeksBySubject.set(item.subjectId, weeks);
  }
  const classesPerWeek = new Map<number, number>();
  for (const [subjectId, count] of futureBySubject) {
    classesPerWeek.set(subjectId, Math.max(1, Math.ceil(count / (weeksBySubject.get(subjectId)?.size ?? 1))));
  }
  const output = courseRows.map(subject => {
    const regular = sessions.filter(record => record.subjectId === subject.id);
    const presentRegular = regular.filter(record => record.status === "present").length;
    const absentRegular = regular.filter(record => record.status === "absent").length;
    const subjectExtras = extras.filter(item => item.subjectId === subject.id);
    const countedExtras = subjectExtras.filter(item => item.countsTowardAttendance && !item.separateCategory && item.attendanceStatus !== "upcoming");
    const countedPresent = countedExtras.filter(item => item.attendanceStatus === "present").length;
    const countedAbsent = countedExtras.filter(item => item.attendanceStatus === "absent").length;
    const present = presentRegular + countedPresent;
    const absent = absentRegular + countedAbsent;
    const total = present + absent;
    const configuredRequired = subject.requiredAttendance ?? profile?.requiredAttendance ?? null;
    const required = configuredRequired === null ? null : Number(configuredRequired);
    const current = attendancePercent(present, total);
    const remaining = futureBySubject.get(subject.id) ?? null;
    const safe = profile?.safeThreshold === null || profile?.safeThreshold === undefined ? 80 : Number(profile.safeThreshold);
    const watch = profile?.watchThreshold === null || profile?.watchThreshold === undefined ? required : Number(profile.watchThreshold);
    const eligibleExtra = subjectExtras.filter(item => item.countsTowardAttendance && !item.separateCategory && item.attendanceStatus === "upcoming" && item.classDate !== null && item.classDate.getTime() >= todayUtc.getTime()).length;
    const regularFuture = remaining;
    return {
      subjectId: subject.id,
      subject: subject.name,
      code: subject.code,
      present,
      absent,
      total,
      currentPercent: current,
      requiredPercent: required,
      remainingScheduledClasses: remaining,
      classesNeeded: classesNeeded(present, absent, required),
      classesMissable: classesMissable(present, absent, required),
      projectedIfAttendAll: total === 0 || regularFuture === null ? null : projectedPercent(present, absent, regularFuture, 0),
      risk: attendanceBand(current, required, safe, watch),
      extraClasses: {
        total: subjectExtras.length,
        present: subjectExtras.filter(x => x.attendanceStatus === "present").length,
        countsIncluded: countedExtras.length,
        eligibleUpcoming: eligibleExtra,
        officialRuleConfigured: subjectExtras.some(x => x.countsTowardAttendance || x.separateCategory),
      },
      projectionIncludingEligibleExtras: total === 0 || regularFuture === null ? null : projectedPercent(present, absent, regularFuture + eligibleExtra, 0),
      source: regular.length || subjectExtras.length ? "imported_or_user_entered" : "no_attendance_records",
    };
  });
  return {
    requiredAttendance: profile?.requiredAttendance === null || profile?.requiredAttendance === undefined ? null : Number(profile.requiredAttendance),
    overall: (() => {
      const totalPresent = output.reduce((n, item) => n + item.present, 0);
      const totalClasses = output.reduce((n, item) => n + item.total, 0);
      return { present: totalPresent, total: totalClasses, percent: attendancePercent(totalPresent, totalClasses) };
    })(),
    subjects: output,
    extraClasses: extras.map(item => ({
      id: item.id,
      subjectId: item.subjectId,
      subject: courseRows.find(row => row.id === item.subjectId)?.name ?? "Unknown subject",
      classDate: item.classDate,
      faculty: item.faculty,
      status: item.attendanceStatus,
      countsTowardAttendance: item.countsTowardAttendance,
      separateCategory: item.separateCategory,
    })),
    scenarios: output.map(item => ({
      subjectId: item.subjectId,
      subject: item.subject,
      scenarios: item.total === 0 || item.remainingScheduledClasses === null ? null : semesterScenarios(
        item.present,
        item.absent,
        item.remainingScheduledClasses,
        classesPerWeek.get(item.subjectId) ?? 1,
        item.extraClasses.eligibleUpcoming,
        weeksBySubject.get(item.subjectId)?.size ?? 1,
      ),
    })),
    upcomingClassCountAvailable: futureRows.length > 0,
  };
}

export async function getTimetable(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.select({ id: timetable.id, subjectId: timetable.subjectId, subjectName: subjects.name, code: subjects.code, classDate: timetable.classDate, startTime: timetable.startTime, endTime: timetable.endTime, room: timetable.room, faculty: timetable.faculty })
    .from(timetable).innerJoin(subjects, eq(timetable.subjectId, subjects.id))
    .where(eq(timetable.userId, userId)).orderBy(asc(timetable.classDate));
}

export async function getAssignments(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.select({ id: assignments.id, subjectId: assignments.subjectId, subjectName: subjects.name, title: assignments.title, description: assignments.description, dueAt: assignments.dueAt, status: assignments.status })
    .from(assignments).innerJoin(subjects, eq(assignments.subjectId, subjects.id)).where(eq(assignments.userId, userId)).orderBy(asc(assignments.dueAt));
}

export async function getMarks(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.select({ id: marks.id, subjectId: marks.subjectId, subjectName: subjects.name, title: marks.title, score: marks.score, maximumScore: marks.maximumScore, markedAt: marks.markedAt })
    .from(marks).innerJoin(subjects, eq(marks.subjectId, subjects.id)).where(eq(marks.userId, userId)).orderBy(desc(marks.markedAt));
}

export async function getResults(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.select({ id: results.id, subjectId: results.subjectId, subjectName: subjects.name, term: results.term, grade: results.grade, gradePoints: results.gradePoints })
    .from(results).innerJoin(subjects, eq(results.subjectId, subjects.id)).where(eq(results.userId, userId));
}

export async function getCredits(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.select({ id: credits.id, subjectId: credits.subjectId, subjectName: subjects.name, term: credits.term, earned: credits.earned, status: credits.status })
    .from(credits).leftJoin(subjects, eq(credits.subjectId, subjects.id)).where(eq(credits.userId, userId));
}

export async function getExamDates(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.select({ id: examSchedule.id, subjectId: examSchedule.subjectId, subjectName: subjects.name, title: examSchedule.title, examAt: examSchedule.examAt, note: examSchedule.note })
    .from(examSchedule).innerJoin(subjects, eq(examSchedule.subjectId, subjects.id)).where(eq(examSchedule.userId, userId)).orderBy(asc(examSchedule.examAt));
}

function normalizeStudent(input: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};
  for (const field of ["displayName", "program", "semester"] as const) if (field in input) patch[field] = text(input[field], 160);
  for (const field of ["cgpa", "requiredAttendance", "safeThreshold", "watchThreshold"] as const) {
    if (field in input) patch[field] = decimalString(input[field], field === "cgpa" ? 10 : 100);
  }
  if ("creditsEarned" in input) {
    const n = number(input.creditsEarned);
    if (input.creditsEarned !== null && input.creditsEarned !== undefined && String(input.creditsEarned).trim() !== "" && n === null) throw new ImportValidationError("Credits earned must be a valid number.");
    if (n !== null && (!Number.isInteger(n) || n < 0)) throw new ImportValidationError("Credits earned must be a non-negative whole number.");
    patch.creditsEarned = n;
  }
  return patch;
}

export async function saveStudentSettings(userId: number, input: Record<string, unknown>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const patch = normalizeStudent(input);
  const [current] = await db.select().from(students).where(eq(students.userId, userId)).limit(1);
  if (current) await db.update(students).set(patch).where(eq(students.userId, userId));
  else await db.insert(students).values({ userId, ...patch } as typeof students.$inferInsert);
  return getStudentProfile(userId);
}

export async function applyAcademicImport(userId: number, payload: ImportPayload) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const counts = { added: 0, updated: 0, unchanged: 0, rejected: 0, rejectionDetails: [] as string[] };
  const rejectRow = (kind: string, rowNumber: number, reason: string) => {
    counts.rejected += 1;
    if (counts.rejectionDetails.length < 50) counts.rejectionDetails.push(`${kind} row ${rowNumber}: ${reason}`);
  };
  const firstValue = (row: Record<string, unknown>, ...keys: string[]) => keys.map(key => row[key]).find(value => value !== undefined && value !== null && String(value).trim() !== "");
  const requiredText = (row: Record<string, unknown>, keys: string[], max: number, label: string) => {
    const value = text(firstValue(row, ...keys), max);
    if (!value) throw new ImportValidationError(`${label} is required.`);
  };
  const validateCalendarDate = (row: Record<string, unknown>, keys: string[], label: string) => {
    if (!calendarDate(firstValue(row, ...keys))) throw new ImportValidationError(`${label} must be a valid date.`);
  };
  const validateOptionalDate = (row: Record<string, unknown>, keys: string[], label: string) => {
    const value = firstValue(row, ...keys);
    if (value !== undefined && !date(value)) throw new ImportValidationError(`${label} must be a valid date.`);
  };
  const validateSubjectMetadata = (row: Record<string, unknown>) => {
    text(row.subjectCode ?? row.code, 64);
    text(row.semester, 80);
    decimalString(row.requiredAttendance, 100);
  };
  const validateSubjectRow = (row: Record<string, unknown>) => {
    requiredText(row, ["subjectName", "subject", "name", "course"], 180, "A subject name");
    validateSubjectMetadata(row);
  };
  const validateFlag = (row: Record<string, unknown>, key: string) => {
    const value = row[key];
    if (value === undefined || value === null || String(value).trim() === "") return;
    if (!["true", "false", "yes", "no", "1", "0", "y", "n"].includes(String(value).trim().toLowerCase())) throw new ImportValidationError(`${key} must be yes or no.`);
  };
  const filterRows = (kind: string, rows: Array<Record<string, unknown>> | undefined, validate: (row: Record<string, unknown>) => void) =>
    (rows ?? []).filter((row, index) => {
      try { validate(row); return true; }
      catch (error) {
        if (!(error instanceof ImportValidationError)) throw error;
        rejectRow(kind, index + 1, error.message);
        return false;
      }
    });
  let cleanStudent = payload.student;
  if (cleanStudent) {
    try { normalizeStudent(cleanStudent); }
    catch (error) {
      if (!(error instanceof ImportValidationError)) throw error;
      rejectRow("Student profile", 1, error.message);
      cleanStudent = undefined;
    }
  }
  const cleanPayload: ImportPayload = {
    ...payload,
    student: cleanStudent,
    subjects: filterRows("Subject", payload.subjects, validateSubjectRow),
    attendance: filterRows("Attendance", payload.attendance, row => {
      validateSubjectRow(row);
      if (!safeStatus(row.status ?? row.attendanceStatus)) throw new ImportValidationError("Status must be present or absent.");
      validateCalendarDate(row, ["classDate", "date"], "Class date");
      text(row.source, 32);
    }),
    extraClasses: filterRows("Extra class", payload.extraClasses, row => {
      validateSubjectRow(row);
      const status = firstValue(row, "attendanceStatus", "status");
      if (status !== undefined && !safeStatus(status) && String(status).trim().toLowerCase() !== "upcoming") throw new ImportValidationError("Status must be upcoming, present, or absent.");
      validateCalendarDate(row, ["classDate", "date"], "Extra-class date");
      text(row.faculty, 180);
      validateFlag(row, "countsTowardAttendance");
      validateFlag(row, "separateCategory");
    }),
    timetable: filterRows("Timetable", payload.timetable, row => {
      validateSubjectRow(row);
      validateCalendarDate(row, ["classDate", "date"], "Timetable class date");
      text(row.startTime, 16); text(row.endTime, 16); text(row.room, 80); text(row.faculty, 180);
    }),
    marks: filterRows("Mark", payload.marks, row => {
      validateSubjectRow(row);
      requiredText(row, ["title", "assessment"], 180, "A mark title");
      decimalString(row.score ?? row.mark, 999999);
      decimalString(row.maximumScore ?? row.maxScore, 999999);
      validateOptionalDate(row, ["markedAt", "date"], "Mark date");
    }),
    results: filterRows("Result", payload.results, row => {
      validateSubjectRow(row); text(row.term, 80); text(row.grade, 16); decimalString(row.gradePoints, 10);
    }),
    credits: filterRows("Credits", payload.credits, row => {
      const earned = number(row.earned ?? row.credits);
      if (earned === null || earned < 0) throw new ImportValidationError("Earned credits must be a non-negative number.");
      const subjectName = firstValue(row, "subjectName", "subject", "name", "course");
      if (subjectName !== undefined) requiredText(row, ["subjectName", "subject", "name", "course"], 180, "A subject name");
      validateSubjectMetadata(row); text(row.term, 80); text(row.status, 32);
    }),
    assignments: filterRows("Assignment", payload.assignments, row => {
      validateSubjectRow(row);
      requiredText(row, ["title", "assignment"], 240, "An assignment title");
      text(row.description, 2000);
      validateOptionalDate(row, ["dueAt", "date"], "Assignment due date");
      const status = String(row.status ?? "pending").trim().toLowerCase();
      if (!["pending", "completed", "in_progress", "in progress"].includes(status)) throw new ImportValidationError("Assignment status must be pending, in progress, or completed.");
    }),
    exams: filterRows("Exam", payload.exams, row => {
      validateSubjectRow(row);
      if (!text(row.title ?? row.examName ?? "Exam", 180)) throw new ImportValidationError("An exam title is required.");
      validateCalendarDate(row, ["examAt", "examDate", "date"], "Exam date");
      text(row.note, 1000);
    }),
  };
  payload = cleanPayload;
  await db.transaction(async tx => {
    if (payload.student) {
      const patch = normalizeStudent(payload.student);
      const [existing] = await tx.select().from(students).where(eq(students.userId, userId)).limit(1);
      if (existing) {
        await tx.update(students).set(patch).where(eq(students.userId, userId));
        counts.updated += 1;
      } else {
        await tx.insert(students).values({ userId, ...patch } as typeof students.$inferInsert);
        counts.added += 1;
      }
    }
    const currentSubjects = await tx.select().from(subjects).where(eq(subjects.userId, userId));
    const byName = new Map(currentSubjects.map(row => [row.name.trim().toLowerCase(), row]));
    const byCode = new Map(currentSubjects.filter(row => row.code).map(row => [row.code!.trim().toLowerCase(), row]));
    const getSubject = async (row: Record<string, unknown>) => {
      const name = text(row.subjectName ?? row.subject ?? row.name ?? row.course, 180);
      const code = text(row.subjectCode ?? row.code, 64);
      if (!name) return null;
      let found = (code ? byCode.get(code.toLowerCase()) : undefined) ?? byName.get(name.toLowerCase());
      if (found) return found;
      await tx.insert(subjects).values({ userId, name, code, semester: text(row.semester, 80), requiredAttendance: decimalString(row.requiredAttendance, 100) });
      const [created] = await tx.select().from(subjects).where(and(eq(subjects.userId, userId), eq(subjects.name, name))).limit(1);
      if (!created) throw new Error("The subject could not be saved.");
      byName.set(created.name.toLowerCase(), created);
      if (created.code) byCode.set(created.code.toLowerCase(), created);
      counts.added += 1;
      return created;
    };
    for (const [rowIndex, item] of (payload.subjects ?? []).entries()) {
      const subject = await getSubject(item);
      if (!subject) { rejectRow("Subject", rowIndex + 1, "A subject name is required."); continue; }
      const patch: Record<string, unknown> = {};
      if ("code" in item || "subjectCode" in item) patch.code = text(item.code ?? item.subjectCode, 64);
      if ("semester" in item) patch.semester = text(item.semester, 80);
      if ("requiredAttendance" in item) patch.requiredAttendance = decimalString(item.requiredAttendance, 100);
      if (Object.keys(patch).length) {
        await tx.update(subjects).set(patch).where(eq(subjects.id, subject.id));
        counts.updated += 1;
      } else counts.unchanged += 1;
    }
    for (const [rowIndex, item] of (payload.attendance ?? []).entries()) {
      const subjectName = text(item.subjectName ?? item.subject ?? item.name ?? item.course, 180);
      const status = safeStatus(item.status ?? item.attendanceStatus);
      const classDate = calendarDate(item.classDate ?? item.date);
      if (!subjectName || !status || !classDate) { rejectRow("Attendance", rowIndex + 1, !subjectName ? "A subject is required." : !status ? "Status must be present or absent." : "A valid class date is required."); continue; }
      const subject = await getSubject(item);
      if (!subject) { rejectRow("Attendance", rowIndex + 1, "A subject is required."); continue; }
      const nextDay = new Date(classDate.getTime() + 86400000);
      const duplicate = await tx.select({ id: attendance.id, status: attendance.status, classDate: attendance.classDate }).from(attendance).where(and(eq(attendance.userId, userId), eq(attendance.subjectId, subject.id), gte(attendance.classDate, classDate), lt(attendance.classDate, nextDay))).limit(1);
      const source = text(item.source, 32) ?? "user_import";
      if (duplicate[0]) {
        if (duplicate[0].status === status && duplicate[0].classDate?.getTime() === classDate.getTime()) counts.unchanged += 1;
        else { await tx.update(attendance).set({ classDate, status, source }).where(eq(attendance.id, duplicate[0].id)); counts.updated += 1; }
        continue;
      }
      await tx.insert(attendance).values({ userId, subjectId: subject.id, classDate, status, source });
      counts.added += 1;
    }
    for (const [rowIndex, item] of (payload.extraClasses ?? []).entries()) {
      const subjectName = text(item.subjectName ?? item.subject ?? item.name ?? item.course, 180);
      const rawStatus = item.attendanceStatus ?? item.status;
      const status = rawStatus == null ? "upcoming" : safeStatus(rawStatus);
      const classDate = calendarDate(item.classDate ?? item.date);
      if (!subjectName || !status || !classDate) { rejectRow("Extra class", rowIndex + 1, !subjectName ? "A subject is required." : !status ? "Status must be upcoming, present, or absent." : "A valid class date is required."); continue; }
      const subject = await getSubject(item);
      if (!subject) { rejectRow("Extra class", rowIndex + 1, "A subject is required."); continue; }
      const faculty = text(item.faculty, 180);
      const countsTowardAttendance = yes(item.countsTowardAttendance);
      const separateCategory = yes(item.separateCategory);
      const facultyFilter = faculty ? eq(extraClasses.faculty, faculty) : isNull(extraClasses.faculty);
      const duplicate = await tx.select({ id: extraClasses.id }).from(extraClasses).where(and(eq(extraClasses.userId, userId), eq(extraClasses.subjectId, subject.id), eq(extraClasses.classDate, classDate), facultyFilter, eq(extraClasses.attendanceStatus, status), eq(extraClasses.countsTowardAttendance, countsTowardAttendance), eq(extraClasses.separateCategory, separateCategory))).limit(1);
      if (duplicate.length) { counts.unchanged += 1; continue; }
      await tx.insert(extraClasses).values({
        userId, subjectId: subject.id, classDate, faculty,
        attendanceStatus: status, countsTowardAttendance, separateCategory,
      });
      counts.added += 1;
    }
    for (const [rowIndex, item] of (payload.timetable ?? []).entries()) {
      const subjectName = text(item.subjectName ?? item.subject ?? item.name ?? item.course, 180);
      const classDate = calendarDate(item.classDate ?? item.date);
      if (!subjectName || !classDate) { rejectRow("Timetable", rowIndex + 1, !subjectName ? "A subject is required." : "A valid class date is required."); continue; }
      const subject = await getSubject(item);
      if (!subject) { rejectRow("Timetable", rowIndex + 1, "A subject is required."); continue; }
      const duplicate = await tx.select({ id: timetable.id }).from(timetable).where(and(eq(timetable.userId, userId), eq(timetable.subjectId, subject.id), eq(timetable.classDate, classDate))).limit(1);
      if (duplicate.length) { counts.unchanged += 1; continue; }
      await tx.insert(timetable).values({ userId, subjectId: subject.id, classDate, startTime: text(item.startTime, 16), endTime: text(item.endTime, 16), room: text(item.room, 80), faculty: text(item.faculty, 180) });
      counts.added += 1;
    }
    for (const [rowIndex, item] of (payload.marks ?? []).entries()) {
      const subjectName = text(item.subjectName ?? item.subject ?? item.name ?? item.course, 180);
      const title = text(item.title ?? item.assessment, 180);
      if (!subjectName || !title) { rejectRow("Mark", rowIndex + 1, !subjectName ? "A subject is required." : "A mark title is required."); continue; }
      const subject = await getSubject(item);
      if (!subject) { rejectRow("Mark", rowIndex + 1, "A subject is required."); continue; }
      await tx.insert(marks).values({ userId, subjectId: subject.id, title, score: decimalString(item.score ?? item.mark, 999999), maximumScore: decimalString(item.maximumScore ?? item.maxScore, 999999), markedAt: date(item.markedAt ?? item.date) });
      counts.added += 1;
    }
    for (const [rowIndex, item] of (payload.results ?? []).entries()) {
      const subjectName = text(item.subjectName ?? item.subject ?? item.name ?? item.course, 180);
      if (!subjectName) { rejectRow("Result", rowIndex + 1, "A subject is required."); continue; }
      const subject = await getSubject(item);
      if (!subject) { rejectRow("Result", rowIndex + 1, "A subject is required."); continue; }
      await tx.insert(results).values({ userId, subjectId: subject.id, term: text(item.term, 80), grade: text(item.grade, 16), gradePoints: decimalString(item.gradePoints, 10) });
      counts.added += 1;
    }
    for (const [rowIndex, item] of (payload.credits ?? []).entries()) {
      const earned = number(item.earned ?? item.credits);
      if (earned === null || earned < 0) { rejectRow("Credits", rowIndex + 1, "Earned credits must be a non-negative number."); continue; }
      const subject = await getSubject(item);
      await tx.insert(credits).values({ userId, subjectId: subject?.id ?? null, term: text(item.term, 80), earned: earned.toFixed(2), status: text(item.status, 32) });
      counts.added += 1;
    }
    for (const [rowIndex, item] of (payload.assignments ?? []).entries()) {
      const subjectName = text(item.subjectName ?? item.subject ?? item.name ?? item.course, 180);
      const title = text(item.title ?? item.assignment, 240);
      if (!subjectName || !title) { rejectRow("Assignment", rowIndex + 1, !subjectName ? "A subject is required." : "An assignment title is required."); continue; }
      const subject = await getSubject(item);
      if (!subject) { rejectRow("Assignment", rowIndex + 1, "A subject is required."); continue; }
      const existing = await tx.select().from(assignments).where(and(eq(assignments.userId, userId), eq(assignments.subjectId, subject.id), eq(assignments.title, title))).limit(1);
      const statusRaw = String(item.status ?? "pending").toLowerCase();
      const status: "completed" | "in_progress" | "pending" = statusRaw === "completed" ? "completed" : statusRaw === "in_progress" || statusRaw === "in progress" ? "in_progress" : "pending";
      const assignment = { description: text(item.description, 2000), dueAt: date(item.dueAt ?? item.date), status };
      if (existing[0]) {
        await tx.update(assignments).set(assignment).where(eq(assignments.id, existing[0].id));
        counts.updated += 1;
      } else {
        await tx.insert(assignments).values({ userId, subjectId: subject.id, title, ...assignment });
        counts.added += 1;
      }
    }
    for (const [rowIndex, item] of (payload.exams ?? []).entries()) {
      const subjectName = text(item.subjectName ?? item.subject ?? item.name ?? item.course, 180);
      const title = text(item.title ?? item.examName ?? "Exam", 180);
      const examAt = date(item.examAt ?? item.examDate ?? item.date);
      if (!subjectName || !title || !examAt) { rejectRow("Exam", rowIndex + 1, !subjectName ? "A subject is required." : !examAt ? "A valid exam date is required." : "An exam title is required."); continue; }
      const subject = await getSubject(item);
      if (!subject) { rejectRow("Exam", rowIndex + 1, "A subject is required."); continue; }
      const existing = await tx.select({ id: examSchedule.id }).from(examSchedule).where(and(eq(examSchedule.userId, userId), eq(examSchedule.subjectId, subject.id), eq(examSchedule.examAt, examAt))).limit(1);
      if (existing.length) { counts.unchanged += 1; continue; }
      await tx.insert(examSchedule).values({ userId, subjectId: subject.id, title, examAt, note: text(item.note, 1000) });
      counts.added += 1;
    }
  });
  return counts;
}

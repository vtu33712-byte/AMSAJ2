import { describe, expect, it } from "vitest";
import { parseAcademicImport } from "./importParsers";

function textFile(name: string, contents: string): File {
  return { name, text: async () => contents } as File;
}

describe("academic import parsing", () => {
  it("normalizes CSV aliases and captures exam dates without inventing values", async () => {
    const file = textFile("records.csv", [
      "recordType,subject,subjectCode,status,date,title,examDate,score,maxScore",
      "attendance,Data Structures,CS201,present,2026-09-14,,,",
      "exam,Data Structures,CS201,,2026-09-14,Midterm,2026-10-20,,",
      "mark,Data Structures,CS201,,2026-09-11,Quiz 1,,8,10",
    ].join("\n"));
    const result = await parseAcademicImport(file);
    expect(result.subjects).toEqual([expect.objectContaining({ name: "Data Structures", code: "CS201" })]);
    expect(result.attendance).toEqual([expect.objectContaining({ subjectName: "Data Structures", status: "present", classDate: "2026-09-14" })]);
    expect(result.exams).toEqual([expect.objectContaining({ subjectName: "Data Structures", title: "Midterm", examAt: "2026-10-20" })]);
    expect(result.marks).toEqual([expect.objectContaining({ title: "Quiz 1", score: "8", maximumScore: "10" })]);
  });

  it("normalizes a JSON academic export, including extra classes and exam schedules", async () => {
    const file = textFile("records.json", JSON.stringify({
      student: { displayName: "Student" },
      extra_classes: [{ subjectName: "Networks", attendanceStatus: "upcoming", countsTowardAttendance: false }],
      exam_dates: [{ subjectName: "Networks", examAt: "2026-11-02" }],
    }));
    const result = await parseAcademicImport(file);
    expect(result.student?.displayName).toBe("Student");
    expect(result.extraClasses).toHaveLength(1);
    expect(result.exams).toEqual([{ subjectName: "Networks", examAt: "2026-11-02" }]);
  });

  it("rejects unsupported file types and CSV without data rows", async () => {
    await expect(parseAcademicImport(textFile("records.pdf", ""))).rejects.toThrow("Choose a JSON, CSV, or Excel");
    await expect(parseAcademicImport(textFile("empty.csv", "recordType,subject"))).rejects.toThrow("header row and at least one data row");
  });
});

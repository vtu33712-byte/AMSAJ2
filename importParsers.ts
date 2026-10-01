export type AcademicImport = {
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

const cleanKey = (key: string) => key.replace(/[^a-z0-9]/gi, "").toLowerCase();
const toRecords = (value: unknown): Array<Record<string, unknown>> =>
  Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item)) : [];

function normalizeJson(value: unknown): AcademicImport {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The JSON file must contain an object with student/subjects/attendance arrays.");
  const raw = value as Record<string, unknown>;
  return {
    student: raw.student && typeof raw.student === "object" && !Array.isArray(raw.student) ? raw.student as Record<string, unknown> : undefined,
    subjects: toRecords(raw.subjects),
    attendance: toRecords(raw.attendance),
    extraClasses: toRecords(raw.extraClasses ?? raw.extra_classes),
    timetable: toRecords(raw.timetable),
    marks: toRecords(raw.marks),
    results: toRecords(raw.results),
    credits: toRecords(raw.credits),
    assignments: toRecords(raw.assignments),
    exams: toRecords(raw.exams ?? raw.examSchedule ?? raw.exam_dates),
  };
}

function csvRows(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    if (char === '"' && quoted && text[i + 1] === '"') { cell += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell); cell = "";
      if (row.some(v => v.trim())) rows.push(row);
      row = [];
    } else cell += char;
  }
  row.push(cell);
  if (row.some(v => v.trim())) rows.push(row);
  if (rows.length < 2) throw new Error("CSV must contain a header row and at least one data row.");
  const headers = rows[0]!.map(cleanKey);
  return rows.slice(1).map(values => Object.fromEntries(headers.map((key, index) => [key, (values[index] ?? "").trim()])));
}

const value = (row: Record<string, string>, ...keys: string[]) => {
  for (const key of keys) {
    const found = row[cleanKey(key)];
    if (found !== undefined && found !== "") return found;
  }
  return undefined;
};

function fromRows(rows: Array<Record<string, string>>): AcademicImport {
  const result: AcademicImport = { subjects: [], attendance: [], extraClasses: [], timetable: [], marks: [], results: [], credits: [], assignments: [], exams: [] };
  const subjectNames = new Set<string>();
  for (const row of rows) {
    const type = (value(row, "recordType", "type", "record") ?? "").toLowerCase().replace(/[^a-z]/g, "");
    const subjectName = value(row, "subject", "subjectName", "course");
    const code = value(row, "code", "subjectCode");
    if (type === "student" || type === "profile") {
      result.student = {
        displayName: value(row, "displayName", "studentName", "name"),
        program: value(row, "program"), semester: value(row, "semester"),
        cgpa: value(row, "cgpa"), creditsEarned: value(row, "creditsEarned"),
        requiredAttendance: value(row, "requiredAttendance"),
        safeThreshold: value(row, "safeThreshold"), watchThreshold: value(row, "watchThreshold"),
      };
      continue;
    }
    if (!type && !subjectName) continue;
    if (subjectName && !subjectNames.has(subjectName.toLowerCase())) {
      subjectNames.add(subjectName.toLowerCase());
      result.subjects!.push({ name: subjectName, code, semester: value(row, "semester"), requiredAttendance: value(row, "requiredAttendance") });
    }
    if (type === "attendance" || type === "class") {
      result.attendance!.push({ subjectName, subjectCode: code, status: value(row, "status", "attendanceStatus"), classDate: value(row, "date", "classDate") });
    } else if (type === "extraclass" || type === "extra") {
      result.extraClasses!.push({ subjectName, subjectCode: code, attendanceStatus: value(row, "status", "attendanceStatus"), classDate: value(row, "date", "classDate"), faculty: value(row, "faculty"), countsTowardAttendance: value(row, "countsTowardAttendance"), separateCategory: value(row, "separateCategory") });
    } else if (type === "timetable" || type === "schedule" || type === "classschedule") {
      result.timetable!.push({ subjectName, subjectCode: code, classDate: value(row, "date", "classDate"), startTime: value(row, "startTime"), endTime: value(row, "endTime"), room: value(row, "room"), faculty: value(row, "faculty") });
    } else if (type === "mark" || type === "marks") {
      result.marks!.push({ subjectName, subjectCode: code, title: value(row, "title", "assessment") ?? "Imported mark", score: value(row, "score", "mark"), maximumScore: value(row, "maximumScore", "maxScore"), markedAt: value(row, "date", "markedAt") });
    } else if (type === "result" || type === "results") {
      result.results!.push({ subjectName, subjectCode: code, term: value(row, "term"), grade: value(row, "grade"), gradePoints: value(row, "gradePoints") });
    } else if (type === "credit" || type === "credits") {
      result.credits!.push({ subjectName, subjectCode: code, term: value(row, "term"), earned: value(row, "credits", "earned"), status: value(row, "status") });
    } else if (type === "assignment" || type === "assignments") {
      result.assignments!.push({ subjectName, subjectCode: code, title: value(row, "title", "assignment") ?? "Imported assignment", description: value(row, "description"), dueAt: value(row, "dueAt", "date", "deadline"), status: value(row, "status") ?? "pending" });
    } else if (type === "exam" || type === "exams" || type === "examdate") {
      result.exams!.push({ subjectName, subjectCode: code, title: value(row, "title", "examName") ?? "Exam", examAt: value(row, "examAt", "examDate", "date"), note: value(row, "note") });
    } else if (type && type !== "subject") {
      throw new Error(`Unknown CSV record type: ${type}`);
    }
  }
  return result;
}

export async function parseAcademicImport(file: File): Promise<AcademicImport> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "json") return normalizeJson(JSON.parse(await file.text()));
  if (ext === "csv") return fromRows(csvRows(await file.text()));
  if (ext === "xlsx" || ext === "xls") {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    const result: AcademicImport = {};
    const sheetMap: Record<string, keyof AcademicImport> = {
      student: "student", profile: "student", subjects: "subjects", attendance: "attendance", extraclasses: "extraClasses",
      timetable: "timetable", schedule: "timetable", marks: "marks", results: "results", credits: "credits", assignments: "assignments", exams: "exams", examdates: "exams", examschedule: "exams",
    };
    for (const sheetName of workbook.SheetNames) {
      const target = sheetMap[cleanKey(sheetName)];
      if (!target) continue;
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName]!, { defval: "" });
      if (target === "student") result.student = rows[0] ?? {};
      else result[target] = rows;
    }
    if (!Object.keys(result).length) throw new Error("Workbook sheets must be named Student, Subjects, Attendance, Timetable, Marks, Results, Credits, Assignments, or Exams.");
    return result;
  }
  throw new Error("Choose a JSON, CSV, or Excel (.xlsx/.xls) academic export.");
}

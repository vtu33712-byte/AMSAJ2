import {
  boolean,
  decimal,
  index,
  int,
  longtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/** OAuth-backed application users. Academic records are always scoped to this user. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const students = mysqlTable("students", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  displayName: varchar("displayName", { length: 160 }),
  program: varchar("program", { length: 160 }),
  semester: varchar("semester", { length: 80 }),
  cgpa: decimal("cgpa", { precision: 5, scale: 2 }),
  creditsEarned: int("creditsEarned"),
  requiredAttendance: decimal("requiredAttendance", { precision: 5, scale: 2 }),
  safeThreshold: decimal("safeThreshold", { precision: 5, scale: 2 }),
  watchThreshold: decimal("watchThreshold", { precision: 5, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("students_user_unique").on(table.userId)]);

export const subjects = mysqlTable("subjects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 180 }).notNull(),
  code: varchar("code", { length: 64 }),
  semester: varchar("semester", { length: 80 }),
  requiredAttendance: decimal("requiredAttendance", { precision: 5, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("subjects_user_code_unique").on(table.userId, table.code), index("subjects_user_name_idx").on(table.userId, table.name)]);

export const attendance = mysqlTable("attendance", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  subjectId: int("subjectId").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  classDate: timestamp("classDate"),
  status: mysqlEnum("status", ["present", "absent"]).notNull(),
  source: varchar("source", { length: 32 }).notNull().default("manual"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("attendance_user_subject_idx").on(table.userId, table.subjectId), index("attendance_date_idx").on(table.subjectId, table.classDate)]);

export const extraClasses = mysqlTable("extra_classes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  subjectId: int("subjectId").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  classDate: timestamp("classDate"),
  faculty: varchar("faculty", { length: 180 }),
  attendanceStatus: mysqlEnum("attendanceStatus", ["present", "absent", "upcoming"]).notNull(),
  countsTowardAttendance: boolean("countsTowardAttendance").notNull().default(false),
  separateCategory: boolean("separateCategory").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("extra_classes_user_subject_idx").on(table.userId, table.subjectId)]);

export const timetable = mysqlTable("timetable", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  subjectId: int("subjectId").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  classDate: timestamp("classDate").notNull(),
  startTime: varchar("startTime", { length: 16 }),
  endTime: varchar("endTime", { length: 16 }),
  room: varchar("room", { length: 80 }),
  faculty: varchar("faculty", { length: 180 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("timetable_user_date_idx").on(table.userId, table.classDate), index("timetable_subject_date_idx").on(table.subjectId, table.classDate)]);

export const marks = mysqlTable("marks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  subjectId: int("subjectId").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 180 }).notNull(),
  score: decimal("score", { precision: 8, scale: 2 }),
  maximumScore: decimal("maximumScore", { precision: 8, scale: 2 }),
  markedAt: timestamp("markedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("marks_user_subject_idx").on(table.userId, table.subjectId)]);

export const results = mysqlTable("results", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  subjectId: int("subjectId").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  term: varchar("term", { length: 80 }),
  grade: varchar("grade", { length: 16 }),
  gradePoints: decimal("gradePoints", { precision: 5, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("results_user_subject_idx").on(table.userId, table.subjectId)]);

export const examSchedule = mysqlTable("exam_schedule", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  subjectId: int("subjectId").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 180 }).notNull(),
  examAt: timestamp("examAt").notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("exam_user_subject_date_unique").on(table.userId, table.subjectId, table.examAt), index("exam_user_date_idx").on(table.userId, table.examAt)]);

export const credits = mysqlTable("credits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  subjectId: int("subjectId").references(() => subjects.id, { onDelete: "set null" }),
  term: varchar("term", { length: 80 }),
  earned: decimal("earned", { precision: 6, scale: 2 }).notNull(),
  status: varchar("status", { length: 32 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("credits_user_term_idx").on(table.userId, table.term)]);

export const assignments = mysqlTable("assignments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  subjectId: int("subjectId").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 240 }).notNull(),
  description: text("description"),
  dueAt: timestamp("dueAt"),
  status: mysqlEnum("status", ["pending", "in_progress", "completed"]).notNull().default("pending"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("assignments_user_due_idx").on(table.userId, table.dueAt), index("assignments_subject_idx").on(table.subjectId)]);

export const materials = mysqlTable("materials", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  subjectId: int("subjectId").references(() => subjects.id, { onDelete: "set null" }),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 120 }).notNull(),
  fileKey: varchar("fileKey", { length: 512 }),
  subjectName: varchar("subjectName", { length: 180 }),
  unit: varchar("unit", { length: 120 }),
  topic: varchar("topic", { length: 180 }),
  semester: varchar("semester", { length: 80 }),
  pageCount: int("pageCount"),
  contentHash: varchar("contentHash", { length: 64 }).notNull(),
  extractedText: longtext("extractedText"),
  extractionStatus: mysqlEnum("extractionStatus", ["ready", "partial", "unsupported", "failed"]).notNull().default("ready"),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
}, table => [index("materials_user_subject_idx").on(table.userId, table.subjectId), uniqueIndex("materials_user_hash_unique").on(table.userId, table.contentHash)]);

export const materialChunks = mysqlTable("material_chunks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  materialId: int("materialId").notNull().references(() => materials.id, { onDelete: "cascade" }),
  chunkIndex: int("chunkIndex").notNull(),
  pageNumber: int("pageNumber"),
  chunkText: longtext("chunkText").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("material_chunk_order_unique").on(table.materialId, table.chunkIndex), index("material_chunks_user_idx").on(table.userId, table.materialId)]);

export const studyTopics = mysqlTable("study_topics", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  subjectId: int("subjectId").references(() => subjects.id, { onDelete: "set null" }),
  materialId: int("materialId").references(() => materials.id, { onDelete: "set null" }),
  title: varchar("title", { length: 220 }).notNull(),
  learned: boolean("learned").notNull().default(false),
  priority: mysqlEnum("priority", ["high", "normal", "low"]).notNull().default("normal"),
  quizScore: decimal("quizScore", { precision: 5, scale: 2 }),
  revisionCount: int("revisionCount").notNull().default(0),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("study_topics_user_idx").on(table.userId, table.subjectId)]);

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  subjectId: int("subjectId").references(() => subjects.id, { onDelete: "set null" }),
  kind: varchar("kind", { length: 48 }).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  message: text("message").notNull(),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("notifications_user_created_idx").on(table.userId, table.createdAt)]);

export const syncLogs = mysqlTable("sync_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  source: varchar("source", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["running", "completed", "failed"]).notNull(),
  recordsAdded: int("recordsAdded").notNull().default(0),
  recordsUpdated: int("recordsUpdated").notNull().default(0),
  recordsUnchanged: int("recordsUnchanged").notNull().default(0),
  recordsRejected: int("recordsRejected").notNull().default(0),
  errorSummary: varchar("errorSummary", { length: 240 }),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
}, table => [index("sync_logs_user_started_idx").on(table.userId, table.startedAt)]);

export type Student = typeof students.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type AttendanceRecord = typeof attendance.$inferSelect;
export type TimetableEntry = typeof timetable.$inferSelect;

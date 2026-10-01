export type ProviderSyncStatus = {
  available: boolean;
  kind: "authorized_api" | "official_export" | "user_import" | "manual" | "unavailable";
  label: string;
  reason?: string;
};

/** All provider implementations must be user-authorized and must not bypass access controls. */
export interface AcademicDataProvider<TProfile = unknown, TAttendance = unknown, TTimetable = unknown, TMarks = unknown, TResult = unknown, TAssignment = unknown, TCredits = unknown, TMaterials = unknown> {
  getStudentProfile(userId: number): Promise<TProfile | null>;
  getAttendance(userId: number): Promise<TAttendance[]>;
  getTimetable(userId: number): Promise<TTimetable[]>;
  getMarks(userId: number): Promise<TMarks[]>;
  getResults(userId: number): Promise<TResult[]>;
  getAssignments(userId: number): Promise<TAssignment[]>;
  getCredits(userId: number): Promise<TCredits[]>;
  getExamDates(userId: number): Promise<Array<{ subject: string; title: string; examAt: Date }>>;
  getCourseMaterials(userId: number): Promise<TMaterials[]>;
  getStatus(): ProviderSyncStatus;
}

/** Initial no-live-source provider. Imports and user-entered records remain the source of truth. */
export class AuthorizedSourceNotConfiguredProvider implements AcademicDataProvider {
  async getStudentProfile() { return null; }
  async getAttendance() { return []; }
  async getTimetable() { return []; }
  async getMarks() { return []; }
  async getResults() { return []; }
  async getAssignments() { return []; }
  async getCredits() { return []; }
  async getExamDates() { return []; }
  async getCourseMaterials() { return []; }
  getStatus(): ProviderSyncStatus {
    return { available: false, kind: "unavailable", label: "No authorized live source configured", reason: "Import an official export or connect an authorized integration." };
  }
}

export const authorizedSourceProvider = new AuthorizedSourceNotConfiguredProvider();

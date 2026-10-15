export type User = {
  id: string;
  email: string;
  name: string;
  role: "STUDENT" | "ADMIN";
  program: string;
  curriculumYear: number;
};
export type Course = {
  code: string;
  name: string;
  ects: number;
  suggestedSemester: number;
  required: boolean;
  electiveGroup: string | null;
  prerequisites: string[];
};
export type Group = { id: string; name: string; ectsRequired: number };
export type CurriculumData = {
  courses: Course[];
  electiveGroups: Group[];
  totalEcts: number;
  maxEcts: number;
  minEcts: number;
};
export type Curriculum = {
  id: string;
  program: string;
  year: number;
  version: number;
  status: string;
  data: CurriculumData;
};
export type Slot = { day: string; start: number; end: number };
export type Offering = {
  id?: string;
  courseCode: string;
  season: string;
  year: number | null;
  available: boolean;
  slots: Slot[];
};
export type AcademicRecord = {
  id?: string;
  courseCode: string;
  status: string;
  grade: string;
  term: string;
  approved: boolean;
};
export type PlanData = {
  semesters: Record<string, string[]>;
  electives: string[];
  target: string | null;
  failedCourses: string[];
};
export type Plan = {
  id: string;
  studentId: string;
  name: string;
  curriculumId: string;
  data: PlanData;
  revision: number;
  updatedAt: string;
};
export type Issue = {
  severity: string;
  code: string;
  message: string;
  term: string | null;
  courseCode: string | null;
};
export type Evaluation = {
  valid: boolean;
  complete: boolean;
  graduation: string | null;
  targetStatus: string;
  earnedEcts: number;
  plannedEcts: number;
  totalEcts: number;
  issues: Issue[];
  missingCourses: string[];
  requirements: {
    id: string;
    name: string;
    required: number;
    earned: number;
    planned: number;
  }[];
};
export type Detail = {
  plan: Plan;
  curriculum: Curriculum;
  latestCurriculum: Curriculum;
  evaluation: Evaluation;
  student: User;
  currentTerm: string;
};

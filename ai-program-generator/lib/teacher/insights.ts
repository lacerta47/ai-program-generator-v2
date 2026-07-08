import { authedJson } from '@/lib/client/authedFetch';

export interface StudentInsight {
  uid: string;
  name: string;
  hakbun: string;
  /** 올린 작품 수(누적) */
  works: number;
  /** 최근 14일 생성 시도 수(usage) */
  attempts: number;
  /** 최근 활동 시각(ms) */
  lastActive: number | null;
  /** 코드로 써본 개념(순서·조건·반복·입력·출력 순) */
  concepts: string[];
}

export interface TeacherInsights {
  students: StudentInsight[];
  summary: {
    studentCount: number;
    activeCount: number;
    totalWorks: number;
    totalAttempts: number;
  };
}

export function fetchTeacherInsights(): Promise<TeacherInsights> {
  return authedJson<TeacherInsights>('/api/teacher/insights');
}

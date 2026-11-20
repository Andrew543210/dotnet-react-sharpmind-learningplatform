export type Role = 'Student' | 'Mentor' | 'Admin'
export type User = { id: string; fullName: string; email: string; role: Role }
export type Course = {
  id: number
  slug: string
  title: string
  description: string
  topic: string
  level: string
  mentorName: string
  moduleCount: number
  minutes: number
  isPublished: boolean
  isArchived: boolean
  version: number
}
export type ModuleStatus = { key: string; read: boolean; quizScore: number; practiceGrade: number }
export type Submission = {
  id: string
  moduleKey: string
  answer: string
  grade: number | null
  feedback: string
  rubricJson: string
  submittedAt: string
}
export type LearningStatus = {
  modules: ModuleStatus[]
  finalScore: number
  finalUnlocked: boolean
  canCertify: boolean
  progress: number
  certificateId: string | null
  attempts: { id: string; assessmentKey: string; score: number; submittedAt: string }[]
  submissions: Submission[]
}
export type CourseDetail = {
  course: Course
  outcomes: string[]
  prerequisites: string
  modules: { key: string; title: string; minutes: number }[]
  enrollment: { id: number; status: string; decisionReason: string } | null
  status: LearningStatus | null
  rules: { modulePass: number; practicePass: number; finalPass: number }
}
export type Question = {
  id: string
  text: string
  options: string[]
  correct: number
  explanation: string
}
export type Curriculum = {
  outcomes: string[]
  prerequisites: string
  modules: {
    key: string
    title: string
    minutes: number
    lesson: string
    practice: string
    questions: Question[]
  }[]
  finalQuestions: Question[]
}
export const topics: Record<string, string> = {
  Programming: 'Програмування',
  WebDevelopment: 'Веброзробка',
  DataScience: 'Data Science',
  DevOps: 'DevOps',
}
export const levels: Record<string, string> = {
  Beginner: 'Початковий',
  Intermediate: 'Середній',
  Advanced: 'Просунутий',
}
export const statuses: Record<string, string> = {
  Pending: 'На розгляді',
  Approved: 'Доступ відкрито',
  Rejected: 'Заявку відхилено',
}
export const date = (value: string) =>
  new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium' }).format(new Date(value))
export const duration = (minutes: number) => `${Math.round((minutes / 60) * 10) / 10} год`
const pluralRules = new Intl.PluralRules('uk-UA')
// Ukrainian needs three noun forms: 1 модуль, 2 модулі, 5 модулів.
export const plural = (count: number, one: string, few: string, many: string) => {
  const rule = pluralRules.select(count)
  return `${count} ${rule === 'one' ? one : rule === 'few' ? few : many}`
}

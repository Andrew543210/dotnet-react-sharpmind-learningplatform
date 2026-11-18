import { ArrowUpRight, Clock3, Layers3 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Course } from '../../shared/types'
import { duration, levels, topics } from '../../shared/types'

const cover: Record<string, [string, string, string]> = {
  'csharp-collections-async': ['C#', 'var next = await learn();', 'sage'],
  'react-state-forms': ['React', 'UI = f(state)', 'blue'],
  'frontend-foundations': ['HTML / CSS', '<ideas become="interfaces" />', 'sand'],
  'devops-delivery': ['DevOps', 'build → test → ship', 'graphite'],
  'javascript-fullstack': ['JavaScript', 'request → response', 'yellow'],
  'python-data': ['Python', 'data → insight', 'lilac'],
  'java-foundations': ['Java', 'class YourNextStep { }', 'clay'],
  'cpp-memory': ['C++', 'own the lifetime', 'blue'],
  'go-services': ['Go', 'go build ./future', 'sage'],
  'angular-apps': ['Angular', 'components with purpose', 'lilac'],
}
export function CourseCover({ course }: { course: Course }) {
  const [name, code, tone] = cover[course.slug] ?? [
    course.title.split('•')[0],
    'learn · build · understand',
    'sage',
  ]
  return (
    <div className={`course-cover ${tone}`} aria-hidden="true">
      <span className="cover-index">SHARPMIND / PRACTICAL SERIES</span>
      <strong>{name}</strong>
      <code>{code}</code>
      <span className="cover-symbol">↗</span>
    </div>
  )
}
export function CourseCard({ course }: { course: Course }) {
  return (
    <article className="course-card">
      <Link className="cover-link" to={`/courses/${course.id}`} tabIndex={-1} aria-hidden="true">
        <CourseCover course={course} />
      </Link>
      <div className="course-card-body">
        <div className="card-tags">
          <span>{topics[course.topic]}</span>
          <span>{levels[course.level]}</span>
        </div>
        <h2>
          <Link to={`/courses/${course.id}`}>
            {course.title}
            <ArrowUpRight size={18} />
          </Link>
        </h2>
        <p>{course.description}</p>
        <div className="course-meta">
          <span>
            <Layers3 size={15} />
            {course.moduleCount} модулі
          </span>
          <span>
            <Clock3 size={15} />
            {duration(course.minutes)}
          </span>
        </div>
        <div className="card-bottom">
          <span>{course.mentorName}</span>
          <strong>Безоплатно</strong>
        </div>
      </div>
    </article>
  )
}

import Markdown from 'react-markdown'
import type { Components } from 'react-markdown'

// Documentation and video links open in a new tab so the lesson position and an unsent practice
// draft stay where the student left them. Raw HTML stays disabled (the react-markdown default).
const components: Components = {
  a: ({ href, children }) =>
    href && /^https?:\/\//i.test(href) ? (
      <a href={href} target="_blank" rel="noreferrer">
        {children}
        <span className="sr-only"> (відкриється в новій вкладці)</span>
      </a>
    ) : (
      <a href={href}>{children}</a>
    ),
}

export function Prose({ children }: { children: string }) {
  return <Markdown components={components}>{children}</Markdown>
}

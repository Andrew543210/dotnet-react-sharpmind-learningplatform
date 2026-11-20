# SharpMind: product decisions

SharpMind helps Ukrainian-speaking learners turn IT theory into reviewed, demonstrable work. Its defining interaction is a learner working with a course mentor, rather than consuming a video library.

## Source review

Reviewed the original MVC application's README, controllers, services, Identity roles, EF model and migrations, seed curriculum, view models and Razor interfaces at commit `25eb02e610638df1e0a6b1d0804e2843feecf12b`. The source repository is read-only and is not the deployment or development target.

The original supports ten IT subject areas, catalog filters, student enrollment requests, mentor decisions, tests, reviewed practical work, student progress, rankings, certificates, content editing, administration and support tickets. Its payment service validates card-shaped input without charging a provider. Some seeded modules contain placeholder questions or only external links. Startup reseeding rebuilds content. Progress uses 60% while certificate eligibility uses 80% and a fixed four modules; an evaluated practical can count regardless of grade. Some child-resource lookups trust a separately supplied course ID. These behaviors are replaced with explicit server rules.

## Intended experience

1. Discover a course through topic, level and search; inspect its outcomes and syllabus without signing in.
2. Register as a student and request a place. A mentor approves or rejects with a reason; a rejected student can request again.
3. Read self-contained lessons, mark them complete, take ten-question quizzes, submit text/code and receive rubric-based feedback. A passing attempt unlocks the answer review with explanations; a failed one shows the score and sends the learner back to the lesson. Best quiz results and all attempts are retained.
4. Complete every lesson, score at least 70% on each module quiz and 60% on each practical. This unlocks a ten-question final exam, requiring 80%.
5. Receive a unique, verifiable, printable certificate. Repeated issuance returns the same certificate. Course rankings use pseudonymous identifiers, without exposing student email addresses.
6. Mentors manage their courses, requests and grading queue. Administrators manage roles, availability, course assignments and support. In-use curricula are locked to protect existing work; create a new course for a changed syllabus. Archiving a course closes it to new students and rejects pending requests with a stated reason.

The ten original subject areas remain, with focused, honestly scoped short courses. Course content is first-party Ukrainian teaching material, not copied external articles. Each module includes worked examples, self-checks, a practical brief, explicit rubric and a ten-question quiz. Official documentation is linked as further reading. No course advertises job readiness or an accredited qualification.

## Deliberate boundaries

Enrollment is free in this release. There is no card collection or simulated purchase. Payment processing needs a separately chosen provider and commercial terms. Submissions are text/code only, so there is no arbitrary file upload or untrusted-code execution. Public certificate verification reveals only the certificate's named recipient and course, after an unguessable identifier is supplied. Registration does not grant a staff role. No public demo accounts or production passwords are bundled.

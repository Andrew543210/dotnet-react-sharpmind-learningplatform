using Microsoft.AspNetCore.Identity;

namespace SharpMind.Api.Domain;

public sealed class AppUser : IdentityUser
{
    public string FullName { get; set; } = "";
    public string Role { get; set; } = "Student";
    public bool IsDisabled { get; set; }
}

public sealed class Course
{
    public int Id { get; set; }
    public string Slug { get; set; } = "";
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public string Topic { get; set; } = "Programming";
    public string Level { get; set; } = "Beginner";
    public string MentorId { get; set; } = "";
    public AppUser Mentor { get; set; } = null!;
    public string CurriculumJson { get; set; } = "{}";
    public bool IsPublished { get; set; }
    public bool IsArchived { get; set; }
    public int Version { get; set; } = 1;
}

public sealed class Enrollment
{
    public int Id { get; set; }
    public int CourseId { get; set; }
    public Course Course { get; set; } = null!;
    public string StudentId { get; set; } = "";
    public AppUser Student { get; set; } = null!;
    public string Status { get; set; } = "Pending";
    public string DecisionReason { get; set; } = "";
    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;
}

public sealed class LessonCompletion
{
    public int Id { get; set; }
    public int EnrollmentId { get; set; }
    public Enrollment Enrollment { get; set; } = null!;
    public string ModuleKey { get; set; } = "";
}

public sealed class QuizAttempt
{
    public Guid Id { get; set; }
    public int EnrollmentId { get; set; }
    public Enrollment Enrollment { get; set; } = null!;
    public string AssessmentKey { get; set; } = "";
    public string AnswersJson { get; set; } = "{}";
    public int Score { get; set; }
    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
}

public sealed class Submission
{
    public Guid Id { get; set; }
    public int EnrollmentId { get; set; }
    public Enrollment Enrollment { get; set; } = null!;
    public string ModuleKey { get; set; } = "";
    public string Answer { get; set; } = "";
    public int? Grade { get; set; }
    public string Feedback { get; set; } = "";
    public string RubricJson { get; set; } = "[]";
    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
    public DateTime? GradedAt { get; set; }
}

public sealed class Certificate
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public int EnrollmentId { get; set; }
    public Enrollment Enrollment { get; set; } = null!;
    public string FullName { get; set; } = "";
    public string CourseTitle { get; set; } = "";
    public string MentorName { get; set; } = "";
    public int FinalScore { get; set; }
    public DateTime IssuedAt { get; set; } = DateTime.UtcNow;
}

public sealed class SupportTicket
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = "";
    public AppUser User { get; set; } = null!;
    public string Subject { get; set; } = "";
    public string Message { get; set; } = "";
    public string Reply { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ResolvedAt { get; set; }
}

public sealed class CourseMedia
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public int CourseId { get; set; }
    public Course Course { get; set; } = null!;
    public string ModuleKey { get; set; } = "";
    public string Title { get; set; } = "";
    public string ContentType { get; set; } = "";
    public string Transcript { get; set; } = "";
    public long Length { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

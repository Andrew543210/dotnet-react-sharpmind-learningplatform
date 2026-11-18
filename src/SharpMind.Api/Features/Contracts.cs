using System.ComponentModel.DataAnnotations;
using SharpMind.Api.Domain;

namespace SharpMind.Api.Features;

public sealed record RegisterRequest([Required, EmailAddress, MaxLength(254)] string Email,
    [Required, StringLength(128, MinimumLength = 15)] string Password,
    [Required, StringLength(120, MinimumLength = 2)] string FullName);
public sealed record LoginRequest([Required, EmailAddress, MaxLength(254)] string Email, [Required, MaxLength(128)] string Password);
public sealed record PasswordRequest([Required, MaxLength(128)] string CurrentPassword,
    [Required, StringLength(128, MinimumLength = 15)] string NewPassword);
public sealed record QuizRequest(Guid RequestId, [Required] Dictionary<string, int> Answers);
public sealed record SubmissionRequest(Guid RequestId, [Required, StringLength(20000, MinimumLength = 80)] string Answer);
public sealed record GradeRequest([Range(0, 40)] int Correctness, [Range(0, 25)] int Reasoning,
    [Range(0, 25)] int Testing, [Range(0, 10)] int Clarity, [Required, StringLength(3000, MinimumLength = 20)] string Feedback);
public sealed record EnrollmentDecision([Required, RegularExpression("^(Approved|Rejected)$")] string Status, [MaxLength(1000)] string Reason);
public sealed record TicketRequest(Guid RequestId, [Required, StringLength(120, MinimumLength = 5)] string Subject,
    [Required, StringLength(4000, MinimumLength = 20)] string Message);
public sealed record ReplyRequest([Required, StringLength(4000, MinimumLength = 20)] string Reply);
public sealed record UserUpdate([Required, RegularExpression("^(Student|Mentor|Admin)$")] string Role, bool IsDisabled);
public sealed record AssignmentRequest([Required] string MentorId, int Version);
public sealed record CourseRequest([Required, RegularExpression("^[a-z0-9]+(?:-[a-z0-9]+)*$"), MaxLength(100)] string Slug,
    [Required, StringLength(160, MinimumLength = 5)] string Title,
    [Required, StringLength(2400, MinimumLength = 40)] string Description,
    [Required, RegularExpression("^(Programming|WebDevelopment|DataScience|DevOps)$")] string Topic,
    [Required, RegularExpression("^(Beginner|Intermediate|Advanced)$")] string Level,
    [Required] Curriculum Content, int Version);

using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SharpMind.Api.Domain;
using SharpMind.Api.Infrastructure;

namespace SharpMind.Api.Features;

[Authorize(Roles = "Mentor,Admin"), Route("api/staff")]
public sealed class StaffController(AppDbContext db) : ApiController
{
    private IQueryable<Course> Owned => db.Courses.Where(c => c.MentorId == UserId || IsAdmin);

    [HttpGet("courses")]
    public async Task<object> Courses() => await Owned.OrderBy(c => c.Title).Select(c => new
    {
        c.Id, c.Title, c.IsPublished, c.IsArchived, c.Version,
        mentorName = c.Mentor.FullName,
        students = db.Enrollments.Count(e => e.CourseId == c.Id && e.Status == "Approved"),
        pending = db.Enrollments.Count(e => e.CourseId == c.Id && e.Status == "Pending"),
        certificates = db.Certificates.Count(x => x.Enrollment.CourseId == c.Id)
    }).ToListAsync();

    [HttpGet("courses/{id:int}")]
    public async Task<object> Course(int id)
    {
        var c = await Owned.AsNoTracking().SingleOrDefaultAsync(c => c.Id == id) ?? throw Missing();
        return new { c.Id, c.Slug, c.Title, c.Description, c.Topic, c.Level, c.IsPublished, c.IsArchived, c.Version, c.MentorId,
            content = Curriculum.FromJson(c.CurriculumJson), contentLocked = await db.Enrollments.AnyAsync(e => e.CourseId == id && e.Status == "Approved") };
    }

    [HttpPost("courses")]
    public async Task<object> Create(CourseRequest request)
    {
        ValidateDraft(request.Content);
        var c = new Course { Slug = request.Slug, Title = request.Title.Trim(), Description = request.Description.Trim(),
            Topic = request.Topic, Level = request.Level, MentorId = UserId, CurriculumJson = request.Content.ToJson() };
        db.Courses.Add(c);
        await db.SaveChangesAsync();
        return new { c.Id };
    }

    [HttpPut("courses/{id:int}")]
    public async Task<IActionResult> Update(int id, CourseRequest request)
    {
        ValidateDraft(request.Content);
        await using var tx = await db.Database.BeginTransactionAsync();
        var c = await db.LockCourse(id) ?? throw Missing();
        Require(IsAdmin || c.MentorId == UserId, "Курс не знайдено.", 404);
        Require(c.Version == request.Version, "Курс уже змінено. Оновіть сторінку перед редагуванням.", 409);
        var changed = Curriculum.FromJson(c.CurriculumJson).ToJson() != request.Content.ToJson();
        Require(!changed || !await db.Enrollments.AnyAsync(e => e.CourseId == id && e.Status == "Approved"),
            "За цим курсом уже навчаються. Створіть новий курс для зміненої програми.", 409);
        if (c.IsPublished) Require(request.Content.Validate() is null, request.Content.Validate() ?? "Некоректна програма.");
        c.Slug = request.Slug; c.Title = request.Title.Trim(); c.Description = request.Description.Trim();
        c.Topic = request.Topic; c.Level = request.Level; c.CurriculumJson = request.Content.ToJson(); c.Version++;
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return NoContent();
    }

    [HttpPost("courses/{id:int}/publish")]
    public async Task<IActionResult> Publish(int id, [FromQuery] int version, [FromQuery] bool published)
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        var c = await db.LockCourse(id) ?? throw Missing();
        Require(IsAdmin || c.MentorId == UserId, "Курс не знайдено.", 404);
        Require(c.Version == version, "Курс уже змінено. Оновіть сторінку.", 409);
        Require(!c.IsArchived, "Спочатку відновіть курс з архіву.", 409);
        if (published)
        {
            var error = Curriculum.FromJson(c.CurriculumJson).Validate();
            Require(error is null, error ?? "Некоректна програма.");
            Require(await db.Users.AnyAsync(u => u.Id == c.MentorId && !u.IsDisabled && (u.Role == "Mentor" || u.Role == "Admin")),
                "Призначте активного ментора перед публікацією.", 409);
        }
        c.IsPublished = published; c.Version++;
        await db.SaveChangesAsync(); await tx.CommitAsync();
        return NoContent();
    }

    [HttpPost("courses/{id:int}/archive")]
    public async Task<IActionResult> Archive(int id, [FromQuery] int version, [FromQuery] bool archived)
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        var c = await db.LockCourse(id) ?? throw Missing();
        Require(IsAdmin || c.MentorId == UserId, "Курс не знайдено.", 404);
        Require(c.Version == version, "Курс уже змінено. Оновіть сторінку.", 409);
        c.IsArchived = archived; c.IsPublished = false; c.Version++;
        await db.SaveChangesAsync(); await tx.CommitAsync();
        return NoContent();
    }

    [HttpGet("enrollments")]
    public async Task<object> Enrollments() => await db.Enrollments.Where(e => e.Course.MentorId == UserId || IsAdmin)
        .OrderByDescending(e => e.RequestedAt).Take(200).Select(e => new { e.Id, e.CourseId, courseTitle = e.Course.Title,
            studentName = e.Student.FullName, e.Status, e.DecisionReason, e.RequestedAt }).ToListAsync();

    [HttpPost("enrollments/{id:int}/decision")]
    public async Task<IActionResult> Decide(int id, EnrollmentDecision request)
    {
        var lookup = await db.Enrollments.AsNoTracking().Where(e => e.Id == id && (e.Course.MentorId == UserId || IsAdmin))
            .Select(e => new { e.CourseId, e.StudentId }).SingleOrDefaultAsync() ?? throw Missing();
        await using var tx = await db.Database.BeginTransactionAsync();
        var course = await db.LockCourse(lookup.CourseId) ?? throw Missing();
        Require(IsAdmin || course.MentorId == UserId, "Заявку не знайдено.", 404);
        var e = await db.LockEnrollment(lookup.CourseId, lookup.StudentId) ?? throw Missing();
        if (e.Status == request.Status) return NoContent();
        Require(e.Status == "Pending", "Рішення вже прийнято. Оновіть список.", 409);
        Require(request.Status != "Rejected" || request.Reason.Trim().Length >= 10, "Поясніть причину відмови (від 10 символів).");
        Require(request.Status != "Approved" || !course.IsArchived && Curriculum.FromJson(course.CurriculumJson).Validate() is null,
            "Курс має бути повним і не архівованим.", 409);
        e.Status = request.Status; e.DecisionReason = request.Reason.Trim();
        await db.SaveChangesAsync(); await tx.CommitAsync();
        return NoContent();
    }

    [HttpGet("submissions")]
    public async Task<object> Submissions() => await db.Submissions.Where(s => s.Enrollment.Course.MentorId == UserId || IsAdmin)
        .OrderBy(s => s.Grade != null).ThenBy(s => s.SubmittedAt).Take(200).Select(s => new { s.Id, s.ModuleKey, s.Answer, s.Grade, s.Feedback, s.RubricJson,
            s.SubmittedAt, courseId = s.Enrollment.CourseId, courseTitle = s.Enrollment.Course.Title, studentName = s.Enrollment.Student.FullName }).ToListAsync();

    [HttpPost("submissions/{id:guid}/grade")]
    public async Task<IActionResult> Grade(Guid id, GradeRequest request)
    {
        Require(request.Feedback.Trim().Length >= 20, "Додайте змістовний відгук (від 20 символів).");
        var lookup = await db.Submissions.AsNoTracking().Where(s => s.Id == id && (s.Enrollment.Course.MentorId == UserId || IsAdmin))
            .Select(s => new { s.Enrollment.CourseId, s.Enrollment.StudentId }).SingleOrDefaultAsync() ?? throw Missing();
        await using var tx = await db.Database.BeginTransactionAsync();
        var course = await db.LockCourse(lookup.CourseId) ?? throw Missing();
        Require(IsAdmin || course.MentorId == UserId, "Роботу не знайдено.", 404);
        _ = await db.LockEnrollment(lookup.CourseId, lookup.StudentId) ?? throw Missing();
        var submission = await db.Submissions.SingleAsync(s => s.Id == id);
        var grade = request.Correctness + request.Reasoning + request.Testing + request.Clarity;
        var rubric = JsonSerializer.Serialize(new[] { request.Correctness, request.Reasoning, request.Testing, request.Clarity });
        if (submission.Grade is not null)
        {
            Require(submission.Grade == grade && submission.Feedback == request.Feedback.Trim()
                && JsonSerializer.Deserialize<int[]>(submission.RubricJson)!.SequenceEqual(JsonSerializer.Deserialize<int[]>(rubric)!),
                "Роботу вже оцінено. Збережену оцінку не можна перезаписати.", 409);
            return NoContent();
        }
        submission.Grade = grade; submission.Feedback = request.Feedback.Trim(); submission.RubricJson = rubric; submission.GradedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(); await tx.CommitAsync();
        return NoContent();
    }

    private static void ValidateDraft(Curriculum content)
    {
        Require(content is not null && content.Outcomes is not null && content.Prerequisites is not null
            && content.Modules is not null && content.FinalQuestions is not null, "Неповна структура програми.");
        Require(content!.Modules.Length <= 20 && content.ToJson().Length <= 800000 && content.Modules.All(m => m is not null
            && m.Questions is not null && m.Lesson is not null && m.Practice is not null && m.Title is not null && m.Key is not null),
            "Програма має некоректну структуру або завелика.");
    }
}

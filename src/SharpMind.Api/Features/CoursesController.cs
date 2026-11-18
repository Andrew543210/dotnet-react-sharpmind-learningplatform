using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SharpMind.Api.Domain;
using SharpMind.Api.Infrastructure;

namespace SharpMind.Api.Features;

[Route("api/courses")]
public sealed class CoursesController(AppDbContext db, LearningService learning) : ApiController
{
    [HttpGet]
    public async Task<object> Catalog([FromQuery] string? search, [FromQuery] string? topic, [FromQuery] string? level,
        [FromQuery] string sort = "title", [FromQuery] int page = 1)
    {
        Require(page is >= 1 and <= 10000 && (search?.Length ?? 0) <= 100, "Невірні параметри пошуку.");
        var query = db.Courses.AsNoTracking().Where(c => c.IsPublished && !c.IsArchived);
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(c => c.Title.ToLower().Contains(search.Trim().ToLower()));
        if (!string.IsNullOrEmpty(topic)) query = query.Where(c => c.Topic == topic);
        if (!string.IsNullOrEmpty(level)) query = query.Where(c => c.Level == level);
        var total = await query.CountAsync();
        query = sort == "popular" ? query.OrderByDescending(c => db.Enrollments.Count(e => e.CourseId == c.Id && e.Status == "Approved")).ThenBy(c => c.Title)
            : sort == "newest" ? query.OrderByDescending(c => c.Id) : query.OrderBy(c => c.Title);
        var courses = await query.Include(c => c.Mentor).Skip((page - 1) * 12).Take(12).ToListAsync();
        return new { total, page, items = courses.Select(Card) };
    }

    [HttpGet("{id:int}")]
    public async Task<object> Details(int id)
    {
        var course = await db.Courses.AsNoTracking().Include(c => c.Mentor).SingleOrDefaultAsync(c => c.Id == id) ?? throw Missing();
        var enrollment = User.Identity?.IsAuthenticated == true
            ? await db.Enrollments.SingleOrDefaultAsync(e => e.CourseId == id && e.StudentId == UserId) : null;
        Require(course.IsPublished && !course.IsArchived || enrollment?.Status == "Approved" || course.MentorId == User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value || IsAdmin,
            "Курс недоступний.", 404);
        var content = Curriculum.FromJson(course.CurriculumJson);
        return new
        {
            course = Card(course), content.Outcomes, content.Prerequisites,
            modules = content.Modules.Select(m => new { m.Key, m.Title, m.Minutes }),
            enrollment = enrollment is null ? null : new { enrollment.Id, enrollment.Status, enrollment.DecisionReason },
            status = enrollment?.Status == "Approved" ? await learning.Status(enrollment, content) : null,
            rules = new { modulePass = LearningRules.ModulePass, practicePass = LearningRules.PracticePass, finalPass = LearningRules.FinalPass }
        };
    }

    [Authorize(Roles = "Student"), HttpPost("{id:int}/enroll")]
    public async Task<object> Enroll(int id)
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        var course = await db.LockCourse(id) ?? throw Missing();
        Require(course.IsPublished && !course.IsArchived, "Курс більше не приймає заявки.", 409);
        var enrollment = await db.Enrollments.SingleOrDefaultAsync(e => e.CourseId == id && e.StudentId == UserId);
        if (enrollment is null)
        {
            enrollment = new Enrollment { CourseId = id, StudentId = UserId };
            db.Enrollments.Add(enrollment);
        }
        else if (enrollment.Status == "Rejected")
        {
            enrollment.Status = "Pending";
            enrollment.DecisionReason = "";
            enrollment.RequestedAt = DateTime.UtcNow;
        }
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return new { enrollment.Id, enrollment.Status };
    }

    [Authorize(Roles = "Student"), HttpGet("mine")]
    public async Task<object> Mine()
    {
        var enrollments = await db.Enrollments.AsNoTracking().Include(e => e.Course).ThenInclude(c => c.Mentor)
            .Where(e => e.StudentId == UserId).OrderByDescending(e => e.RequestedAt).ToListAsync();
        var result = new List<object>();
        foreach (var e in enrollments)
            result.Add(new { course = Card(e.Course), enrollmentStatus = e.Status, e.DecisionReason, status = e.Status == "Approved" ? await learning.Status(e, Curriculum.FromJson(e.Course.CurriculumJson)) : null });
        return result;
    }

    [Authorize(Roles = "Student"), HttpGet("{id:int}/ranking")]
    public async Task<object> Ranking(int id)
    {
        Require(await db.Enrollments.AnyAsync(e => e.CourseId == id && e.StudentId == UserId && e.Status == "Approved"), "Доступ відсутній.", 404);
        var scores = await db.QuizAttempts.Where(a => a.Enrollment.CourseId == id)
            .GroupBy(a => new { a.EnrollmentId, a.AssessmentKey }).Select(g => new { g.Key.EnrollmentId, Score = g.Max(a => a.Score) }).ToListAsync();
        var practice = await db.Submissions.Where(s => s.Enrollment.CourseId == id && s.Grade != null)
            .GroupBy(s => new { s.EnrollmentId, s.ModuleKey }).Select(g => new { g.Key.EnrollmentId, Score = g.Max(s => s.Grade!.Value) }).ToListAsync();
        var enrollmentIds = await db.Enrollments.Where(e => e.CourseId == id && e.Status == "Approved").Select(e => new { e.Id, IsMe = e.StudentId == UserId }).ToListAsync();
        return enrollmentIds.Select(e => new { alias = $"Учасник {e.Id:D4}", isMe = e.IsMe, points = scores.Where(s => s.EnrollmentId == e.Id).Sum(s => s.Score) + practice.Where(s => s.EnrollmentId == e.Id).Sum(s => s.Score) })
            .OrderByDescending(e => e.points).ThenBy(e => e.alias).Select((e, i) => new { rank = i + 1, e.alias, e.isMe, e.points }).Take(100);
    }

    internal static object Card(Course c)
    {
        var content = Curriculum.FromJson(c.CurriculumJson);
        return new { c.Id, c.Slug, c.Title, c.Description, c.Topic, c.Level, mentorName = c.Mentor.FullName,
            moduleCount = content.Modules.Length, minutes = content.Modules.Sum(m => m.Minutes), c.IsPublished, c.IsArchived, c.Version };
    }
}

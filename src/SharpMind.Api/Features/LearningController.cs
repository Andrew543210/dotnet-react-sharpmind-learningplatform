using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SharpMind.Api.Domain;
using SharpMind.Api.Infrastructure;

namespace SharpMind.Api.Features;

[Authorize(Roles = "Student"), Route("api/learning/{courseId:int}")]
public sealed class LearningController(AppDbContext db, LearningService learning) : ApiController
{
    private async Task<(Enrollment Enrollment, Curriculum Content)> Access(int courseId, bool locked = false)
    {
        var e = locked ? await db.LockEnrollment(courseId, UserId)
            : await db.Enrollments.SingleOrDefaultAsync(x => x.CourseId == courseId && x.StudentId == UserId);
        if (e?.Status != "Approved") throw Missing();
        await db.Entry(e).Reference(x => x.Course).LoadAsync();
        return (e, Curriculum.FromJson(e.Course.CurriculumJson));
    }

    [HttpGet("modules/{key}")]
    public async Task<object> Module(int courseId, string key)
    {
        var (e, content) = await Access(courseId);
        var m = content.Modules.SingleOrDefault(m => m.Key == key) ?? throw Missing();
        return new { m.Key, m.Title, m.Minutes, m.Lesson, m.Practice, status = await learning.Status(e, content),
            media = await db.CourseMedia.Where(x => x.CourseId == courseId && x.ModuleKey == key).OrderBy(x => x.CreatedAt)
                .Select(x => new { x.Id, x.Title, x.ContentType, x.Transcript, x.Length }).ToListAsync() };
    }

    [HttpPost("modules/{key}/complete")]
    public async Task<IActionResult> Complete(int courseId, string key)
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        var (e, content) = await Access(courseId, true);
        Require(content.Modules.Any(m => m.Key == key), "Модуль не знайдено.", 404);
        if (!await db.LessonCompletions.AnyAsync(x => x.EnrollmentId == e.Id && x.ModuleKey == key))
            db.LessonCompletions.Add(new LessonCompletion { EnrollmentId = e.Id, ModuleKey = key });
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return NoContent();
    }

    [HttpGet("quizzes/{key}")]
    public async Task<object> Quiz(int courseId, string key)
    {
        var (e, content) = await Access(courseId);
        var status = await learning.Status(e, content);
        var questions = Questions(content, key);
        Require(key != "final" || status.FinalUnlocked, "Спочатку завершіть усі модулі.", 409);
        return new { key, passScore = key == "final" ? LearningRules.FinalPass : LearningRules.ModulePass,
            questions = questions.Select(q => new { q.Id, q.Text, options = q.Options.Select((text, index) => new { value = index, text }).OrderBy(_ => RandomNumberGenerator.GetInt32(int.MaxValue)) }),
            attempts = status.Attempts.Where(a => a.AssessmentKey == key) };
    }

    [HttpPost("quizzes/{key}")]
    public async Task<object> SubmitQuiz(int courseId, string key, QuizRequest request)
    {
        Require(request.RequestId != Guid.Empty, "Потрібен ідентифікатор спроби.");
        await using var tx = await db.Database.BeginTransactionAsync();
        var (e, content) = await Access(courseId, true);
        var questions = Questions(content, key);
        var score = LearningRules.Score(questions, request.Answers);
        var answers = JsonSerializer.Serialize(request.Answers.OrderBy(x => x.Key).ToDictionary(x => x.Key, x => x.Value));
        var existing = await db.QuizAttempts.FindAsync(request.RequestId);
        if (existing is not null)
        {
            Require(existing.EnrollmentId == e.Id && existing.AssessmentKey == key
                && JsonSerializer.Deserialize<Dictionary<string, int>>(existing.AnswersJson)!.OrderBy(x => x.Key).SequenceEqual(request.Answers.OrderBy(x => x.Key)),
                "Ідентифікатор спроби вже використано.", 409);
            return Result(questions, request.Answers, existing.Score);
        }
        var status = await learning.Status(e, content);
        Require(key != "final" || status.FinalUnlocked, "Спочатку завершіть усі модулі.", 409);
        var attempts = status.Attempts.Where(a => a.AssessmentKey == key).ToArray();
        Require(attempts.All(a => a.Score < (key == "final" ? LearningRules.FinalPass : LearningRules.ModulePass)), "Тест уже складено. Результат збережено.", 409);
        Require(attempts.Count(a => a.SubmittedAt > DateTime.UtcNow.AddDays(-1)) < (key == "final" ? 5 : 10), "Ліміт спроб за 24 години вичерпано.", 429);
        Require(attempts.All(a => a.SubmittedAt <= DateTime.UtcNow.AddSeconds(-60)), "Перед наступною спробою зачекайте 60 секунд і перегляньте матеріал.", 429);
        db.QuizAttempts.Add(new QuizAttempt { Id = request.RequestId, EnrollmentId = e.Id, AssessmentKey = key, AnswersJson = answers, Score = score });
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return Result(questions, request.Answers, score);
    }

    [HttpPost("modules/{key}/submissions")]
    public async Task<object> SubmitPractice(int courseId, string key, SubmissionRequest request)
    {
        Require(request.RequestId != Guid.Empty && request.Answer.Trim().Length >= 80, "Додайте код, пояснення й перевірки (від 80 символів).");
        await using var tx = await db.Database.BeginTransactionAsync();
        var (e, content) = await Access(courseId, true);
        Require(content.Modules.Any(m => m.Key == key), "Модуль не знайдено.", 404);
        var existing = await db.Submissions.FindAsync(request.RequestId);
        if (existing is not null)
        {
            Require(existing.EnrollmentId == e.Id && existing.ModuleKey == key && existing.Answer == request.Answer, "Ідентифікатор роботи вже використано.", 409);
            return new { existing.Id };
        }
        var history = await db.Submissions.Where(s => s.EnrollmentId == e.Id && s.ModuleKey == key).ToListAsync();
        Require(history.All(s => s.Grade is not null), "Попередня робота очікує перевірки.", 409);
        Require(history.All(s => s.Grade < LearningRules.PracticePass), "Практику вже зараховано.", 409);
        var submission = new Submission { Id = request.RequestId, EnrollmentId = e.Id, ModuleKey = key, Answer = request.Answer };
        db.Submissions.Add(submission);
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return new { submission.Id };
    }

    [HttpPost("certificate")]
    public async Task<object> Certify(int courseId)
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        var (e, content) = await Access(courseId, true);
        var existing = await db.Certificates.SingleOrDefaultAsync(c => c.EnrollmentId == e.Id);
        if (existing is not null) return new { existing.Id };
        var status = await learning.Status(e, content);
        Require(status.CanCertify, "Вимоги для сертифіката ще не виконано.", 409);
        await db.Entry(e).Reference(x => x.Student).LoadAsync();
        await db.Entry(e.Course).Reference(x => x.Mentor).LoadAsync();
        var certificate = new Certificate { EnrollmentId = e.Id, FullName = e.Student.FullName,
            CourseTitle = e.Course.Title, MentorName = e.Course.Mentor.FullName, FinalScore = status.FinalScore };
        db.Certificates.Add(certificate);
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return new { certificate.Id };
    }

    private static Question[] Questions(Curriculum content, string key) => key == "final" ? content.FinalQuestions
        : content.Modules.SingleOrDefault(m => m.Key == key)?.Questions ?? throw Missing();
    private static object Result(Question[] questions, Dictionary<string, int> answers, int score) => new
    {
        score, feedback = questions.Select(q => new { q.Id, q.Text, selected = answers[q.Id], correct = q.Correct, q.Options, q.Explanation })
    };
}

using Microsoft.EntityFrameworkCore;
using SharpMind.Api.Domain;
using SharpMind.Api.Infrastructure;

namespace SharpMind.Api.Features;

public sealed class LearningService(AppDbContext db)
{
    public async Task<LearningStatus> Status(Enrollment enrollment, Curriculum content)
    {
        var read = await db.LessonCompletions.Where(x => x.EnrollmentId == enrollment.Id).Select(x => x.ModuleKey).ToListAsync();
        var attempts = await db.QuizAttempts.Where(x => x.EnrollmentId == enrollment.Id).OrderByDescending(x => x.SubmittedAt).ToListAsync();
        var submissions = await db.Submissions.Where(x => x.EnrollmentId == enrollment.Id).OrderByDescending(x => x.SubmittedAt).ToListAsync();
        var modules = content.Modules.Select(m => new ModuleStatus(m.Key, read.Contains(m.Key),
            attempts.Where(a => a.AssessmentKey == m.Key).Select(a => a.Score).DefaultIfEmpty(0).Max(),
            submissions.Where(s => s.ModuleKey == m.Key).Select(s => s.Grade ?? 0).DefaultIfEmpty(0).Max())).ToArray();
        var final = attempts.Where(a => a.AssessmentKey == "final").Select(a => a.Score).DefaultIfEmpty(0).Max();
        var unlocked = LearningRules.ModulesComplete(modules);
        var certificate = await db.Certificates.Where(x => x.EnrollmentId == enrollment.Id).Select(x => (Guid?)x.Id).SingleOrDefaultAsync();
        return new(modules, final, unlocked, unlocked && final >= LearningRules.FinalPass,
            LearningRules.Progress(modules, final), certificate,
            attempts.Select(a => new AttemptSummary(a.Id, a.AssessmentKey, a.Score, a.SubmittedAt)).ToArray(),
            submissions.Select(s => new SubmissionSummary(s.Id, s.ModuleKey, s.Answer, s.Grade, s.Feedback, s.RubricJson, s.SubmittedAt)).ToArray());
    }
}

public sealed record AttemptSummary(Guid Id, string AssessmentKey, int Score, DateTime SubmittedAt);
public sealed record SubmissionSummary(Guid Id, string ModuleKey, string Answer, int? Grade, string Feedback, string RubricJson, DateTime SubmittedAt);
public sealed record LearningStatus(ModuleStatus[] Modules, int FinalScore, bool FinalUnlocked, bool CanCertify,
    int Progress, Guid? CertificateId, AttemptSummary[] Attempts, SubmissionSummary[] Submissions);

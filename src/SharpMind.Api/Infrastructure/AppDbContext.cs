using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using SharpMind.Api.Domain;

namespace SharpMind.Api.Infrastructure;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : IdentityUserContext<AppUser>(options)
{
    public DbSet<Course> Courses => Set<Course>();
    public DbSet<Enrollment> Enrollments => Set<Enrollment>();
    public DbSet<LessonCompletion> LessonCompletions => Set<LessonCompletion>();
    public DbSet<QuizAttempt> QuizAttempts => Set<QuizAttempt>();
    public DbSet<Submission> Submissions => Set<Submission>();
    public DbSet<Certificate> Certificates => Set<Certificate>();
    public DbSet<SupportTicket> SupportTickets => Set<SupportTicket>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);
        b.Entity<AppUser>(e =>
        {
            e.Property(x => x.FullName).HasMaxLength(120);
            e.Property(x => x.Role).HasMaxLength(20);
            e.HasIndex(x => x.NormalizedEmail).IsUnique();
            e.ToTable(t => t.HasCheckConstraint("CK_User_Role", "\"Role\" IN ('Student','Mentor','Admin')"));
        });
        b.Entity<Course>(e =>
        {
            e.HasIndex(x => x.Slug).IsUnique();
            e.Property(x => x.Slug).HasMaxLength(100);
            e.Property(x => x.Title).HasMaxLength(160);
            e.Property(x => x.Description).HasMaxLength(2400);
            e.Property(x => x.Topic).HasMaxLength(30);
            e.Property(x => x.Level).HasMaxLength(30);
            e.Property(x => x.CurriculumJson).HasColumnType("jsonb");
            e.Property(x => x.Version).IsConcurrencyToken();
            e.HasOne(x => x.Mentor).WithMany().HasForeignKey(x => x.MentorId).OnDelete(DeleteBehavior.Restrict);
        });
        b.Entity<Enrollment>(e =>
        {
            e.HasIndex(x => new { x.CourseId, x.StudentId }).IsUnique();
            e.HasOne(x => x.Course).WithMany().HasForeignKey(x => x.CourseId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Student).WithMany().HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Restrict);
            e.Property(x => x.Status).HasMaxLength(20);
            e.Property(x => x.DecisionReason).HasMaxLength(1000);
            e.ToTable(t => t.HasCheckConstraint("CK_Enrollment_Status", "\"Status\" IN ('Pending','Approved','Rejected')"));
        });
        b.Entity<LessonCompletion>(e =>
        {
            e.HasIndex(x => new { x.EnrollmentId, x.ModuleKey }).IsUnique();
            e.Property(x => x.ModuleKey).HasMaxLength(60);
        });
        b.Entity<QuizAttempt>(e =>
        {
            e.Property(x => x.Id).ValueGeneratedNever();
            e.HasIndex(x => new { x.EnrollmentId, x.AssessmentKey, x.SubmittedAt });
            e.Property(x => x.AssessmentKey).HasMaxLength(60);
            e.Property(x => x.AnswersJson).HasColumnType("jsonb");
            e.ToTable(t => t.HasCheckConstraint("CK_Quiz_Score", "\"Score\" BETWEEN 0 AND 100"));
        });
        b.Entity<Submission>(e =>
        {
            e.Property(x => x.Id).ValueGeneratedNever();
            e.HasIndex(x => new { x.EnrollmentId, x.ModuleKey, x.SubmittedAt });
            e.Property(x => x.ModuleKey).HasMaxLength(60);
            e.Property(x => x.Answer).HasMaxLength(20000);
            e.Property(x => x.Feedback).HasMaxLength(3000);
            e.Property(x => x.RubricJson).HasColumnType("jsonb");
            e.ToTable(t => t.HasCheckConstraint("CK_Submission_Grade", "\"Grade\" IS NULL OR \"Grade\" BETWEEN 0 AND 100"));
        });
        b.Entity<Certificate>(e =>
        {
            e.HasIndex(x => x.EnrollmentId).IsUnique();
            e.Property(x => x.FullName).HasMaxLength(120);
            e.Property(x => x.CourseTitle).HasMaxLength(160);
            e.Property(x => x.MentorName).HasMaxLength(120);
        });
        b.Entity<SupportTicket>(e =>
        {
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.Subject).HasMaxLength(120);
            e.Property(x => x.Message).HasMaxLength(4000);
            e.Property(x => x.Reply).HasMaxLength(4000);
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        });
    }

    // Every mutation for a learner takes the same row lock. This serializes retries,
    // grading and certificate issuance without a distributed lock or lost updates.
    public Task<Enrollment?> LockEnrollment(int courseId, string userId) => Enrollments
        .FromSqlInterpolated($"SELECT * FROM \"Enrollments\" WHERE \"CourseId\" = {courseId} AND \"StudentId\" = {userId} FOR UPDATE")
        .SingleOrDefaultAsync();
    public Task<Course?> LockCourse(int id) => Courses
        .FromSqlInterpolated($"SELECT * FROM \"Courses\" WHERE \"Id\" = {id} FOR UPDATE").SingleOrDefaultAsync();
}

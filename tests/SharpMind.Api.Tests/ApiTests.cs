using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SharpMind.Api.Domain;
using SharpMind.Api.Infrastructure;

namespace SharpMind.Api.Tests;

public sealed class ApiTests : IClassFixture<ApiFixture>
{
    private readonly ApiFixture f;
    public ApiTests(ApiFixture fixture) => f = fixture;

    [Fact]
    public async Task AuthenticationCsrfRolesAndValidationAreEnforced()
    {
        using var anonymous = f.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/staff/courses")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await anonymous.PostAsJsonAsync("/api/auth/login", new { email = "a@b.test", password = "wrong" })).StatusCode);
        using var student = await f.Login("student");
        Assert.Equal(HttpStatusCode.Forbidden, (await student.GetAsync("/api/admin/users")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await f.Send(student, "/api/staff/courses", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await f.Send(student, "/api/support", new { requestId = Guid.NewGuid(), subject = "X", message = "short" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await student.GetAsync($"/api/learning/{f.OtherCourseId}/modules/state")).StatusCode);
    }

    [Fact]
    public async Task MentorCannotModifyAnotherMentorsCourseOrDecision()
    {
        using var mentor = await f.Login("mentor"); using var student = await f.Login("other");
        Assert.Equal(HttpStatusCode.NotFound, (await mentor.GetAsync($"/api/staff/courses/{f.OtherCourseId}")).StatusCode);
        var enrolled = await f.Send(student, $"/api/courses/{f.OtherCourseId}/enroll");
        var id = (await enrolled.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
        Assert.Equal(HttpStatusCode.NotFound, (await f.Send(mentor, $"/api/staff/enrollments/{id}/decision", new { status = "Approved", reason = "" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await f.Send(mentor, $"/api/staff/courses/{f.OtherCourseId}/archive?version=1&archived=true")).StatusCode);
    }

    [Fact]
    public async Task CompleteLearningWorkflowPreservesIntegrityAndIdempotency()
    {
        using var student = await f.Login("student"); using var mentor = await f.Login("mentor");
        await f.Approve(student, mentor);
        var again = await f.Send(student, $"/api/courses/{f.CourseId}/enroll"); again.EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Conflict, (await f.Send(student, $"/api/learning/{f.CourseId}/certificate")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await student.GetAsync($"/api/learning/{f.CourseId}/quizzes/final")).StatusCode);
        foreach (var module in f.Content.Modules)
        {
            var root = $"/api/learning/{f.CourseId}/modules/{module.Key}";
            (await f.Send(student, $"{root}/complete")).EnsureSuccessStatusCode();
            (await f.Send(student, $"{root}/complete")).EnsureSuccessStatusCode();
            var publicQuiz = await student.GetFromJsonAsync<JsonElement>($"/api/learning/{f.CourseId}/quizzes/{module.Key}");
            Assert.False(publicQuiz.GetProperty("questions")[0].TryGetProperty("correct", out _));
            var answers = module.Questions.ToDictionary(q => q.Id, q => q.Correct);
            var requestId = Guid.NewGuid();
            var body = new { requestId, answers };
            var submitted = await f.Send(student, $"/api/learning/{f.CourseId}/quizzes/{module.Key}", body); submitted.EnsureSuccessStatusCode();
            Assert.Equal(100, (await submitted.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("score").GetInt32());
            (await f.Send(student, $"/api/learning/{f.CourseId}/quizzes/{module.Key}", body)).EnsureSuccessStatusCode();
            Assert.Equal(HttpStatusCode.Conflict, (await f.Send(student, $"/api/learning/{f.CourseId}/quizzes/{module.Key}", new { requestId = Guid.NewGuid(), answers })).StatusCode);
            var submissionId = Guid.NewGuid(); var answer = new string('x', 120);
            (await f.Send(student, $"{root}/submissions", new { requestId = submissionId, answer })).EnsureSuccessStatusCode();
            (await f.Send(student, $"{root}/submissions", new { requestId = submissionId, answer })).EnsureSuccessStatusCode();
            Assert.Equal(HttpStatusCode.Conflict, (await f.Send(student, $"{root}/submissions", new { requestId = Guid.NewGuid(), answer })).StatusCode);
            var grade = new { correctness = 35, reasoning = 20, testing = 20, clarity = 8, feedback = "Correct implementation and meaningful checks of boundary cases." };
            (await f.Send(mentor, $"/api/staff/submissions/{submissionId}/grade", grade)).EnsureSuccessStatusCode();
            (await f.Send(mentor, $"/api/staff/submissions/{submissionId}/grade", grade)).EnsureSuccessStatusCode();
            Assert.Equal(HttpStatusCode.Conflict, (await f.Send(mentor, $"/api/staff/submissions/{submissionId}/grade", grade with { correctness = 20 })).StatusCode);
        }
        var finalAnswers = f.Content.FinalQuestions.ToDictionary(q => q.Id, q => q.Correct);
        (await f.Send(student, $"/api/learning/{f.CourseId}/quizzes/final", new { requestId = Guid.NewGuid(), answers = finalAnswers })).EnsureSuccessStatusCode();
        var certificate = await f.Send(student, $"/api/learning/{f.CourseId}/certificate"); certificate.EnsureSuccessStatusCode();
        var certificateId = (await certificate.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var repeated = await f.Send(student, $"/api/learning/{f.CourseId}/certificate"); repeated.EnsureSuccessStatusCode();
        Assert.Equal(certificateId, (await repeated.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid());
        var verified = await f.CreateClient().GetFromJsonAsync<JsonElement>($"/api/certificates/{certificateId}");
        Assert.Equal(100, verified.GetProperty("finalScore").GetInt32()); Assert.False(verified.TryGetProperty("email", out _));
        using var scope = f.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(2, await db.LessonCompletions.CountAsync(x => x.Enrollment.StudentId == f.StudentId && x.Enrollment.CourseId == f.CourseId));
        Assert.Equal(1, await db.Certificates.CountAsync(x => x.Enrollment.StudentId == f.StudentId));
    }

    [Fact]
    public async Task SupportIsPrivateAndRepeatedRequestsDoNotDuplicate()
    {
        using var first = await f.Login("student"); using var second = await f.Login("other");
        var body = new { requestId = Guid.NewGuid(), subject = "Course access question", message = "Please help with access to my new course materials." };
        (await f.Send(first, "/api/support", body)).EnsureSuccessStatusCode();
        (await f.Send(first, "/api/support", body)).EnsureSuccessStatusCode();
        var own = await first.GetFromJsonAsync<JsonElement>("/api/support"); Assert.Single(own.GetProperty("items").EnumerateArray());
        var others = await second.GetFromJsonAsync<JsonElement>("/api/support"); Assert.Empty(others.GetProperty("items").EnumerateArray());
        Assert.Equal(HttpStatusCode.Conflict, (await f.Send(second, "/api/support", body)).StatusCode);
        using var scope = f.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.SupportTickets.AddRange(Enumerable.Range(1, 51).Select(i => new SupportTicket
        {
            Id = Guid.NewGuid(),
            UserId = f.StudentId,
            Subject = $"Pagination question {i}",
            Message = "A separate support message for pagination verification."
        }));
        await db.SaveChangesAsync();
        var pageOne = await first.GetFromJsonAsync<JsonElement>("/api/support?page=1");
        var pageTwo = await first.GetFromJsonAsync<JsonElement>("/api/support?page=2");
        Assert.Equal(52, pageOne.GetProperty("total").GetInt32());
        Assert.Equal(50, pageOne.GetProperty("items").GetArrayLength());
        Assert.Equal(2, pageTwo.GetProperty("items").GetArrayLength());
        var ids = pageOne.GetProperty("items").EnumerateArray().Select(x => x.GetProperty("id").GetGuid()).ToHashSet();
        Assert.All(pageTwo.GetProperty("items").EnumerateArray(), x => Assert.DoesNotContain(x.GetProperty("id").GetGuid(), ids));
        Assert.Equal(HttpStatusCode.BadRequest, (await first.GetAsync("/api/support?page=0")).StatusCode);
        var privatePage = await second.GetFromJsonAsync<JsonElement>("/api/support?page=2");
        Assert.Equal(0, privatePage.GetProperty("total").GetInt32());
    }
}

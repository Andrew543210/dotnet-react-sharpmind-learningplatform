using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using SharpMind.Api.Domain;
using SharpMind.Api.Infrastructure;

namespace SharpMind.Api.Tests;

public sealed class IntegrityTests : IClassFixture<ApiFixture>
{
    private readonly ApiFixture f;
    public IntegrityTests(ApiFixture fixture) => f = fixture;

    [Fact]
    public async Task ArchivingCourseRejectsPendingRequests()
    {
        using var student = await f.Login("student"); using var mentor = await f.Login("mentor");
        int courseId;
        using (var scope = f.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var mentorId = await db.Users.Where(u => u.Email == "mentor@test.invalid").Select(u => u.Id).SingleAsync();
            var course = new Course { Slug = "archive-check", Title = "Archive check", Description = "Course used to verify archiving.", MentorId = mentorId, IsPublished = true };
            course.SetCurriculum(f.Content);
            db.Courses.Add(course); await db.SaveChangesAsync(); courseId = course.Id;
        }
        (await f.Send(student, $"/api/courses/{courseId}/enroll")).EnsureSuccessStatusCode();
        var version = (await mentor.GetFromJsonAsync<JsonElement>($"/api/staff/courses/{courseId}")).GetProperty("version").GetInt32();
        (await f.Send(mentor, $"/api/staff/courses/{courseId}/archive?version={version}&archived=true")).EnsureSuccessStatusCode();
        var mine = (await student.GetFromJsonAsync<JsonElement>("/api/courses/mine")).EnumerateArray()
            .Single(x => x.GetProperty("course").GetProperty("id").GetInt32() == courseId);
        Assert.Equal("Rejected", mine.GetProperty("enrollmentStatus").GetString());
        Assert.False(string.IsNullOrWhiteSpace(mine.GetProperty("decisionReason").GetString()));
        Assert.Equal(HttpStatusCode.Conflict, (await f.Send(student, $"/api/courses/{courseId}/enroll")).StatusCode);
        var pending = await mentor.GetFromJsonAsync<JsonElement>("/api/staff/enrollments");
        Assert.DoesNotContain(pending.GetProperty("items").EnumerateArray(), x => x.GetProperty("courseId").GetInt32() == courseId);
    }

    [Fact]
    public async Task CatalogCardsSummariseTheStoredProgramme()
    {
        using var anonymous = f.CreateClient();
        var catalog = await anonymous.GetFromJsonAsync<JsonElement>("/api/courses?search=Another%20course");
        var card = Assert.Single(catalog.GetProperty("items").EnumerateArray());
        Assert.Equal(f.Content.Modules.Length, card.GetProperty("moduleCount").GetInt32());
        Assert.Equal(f.Content.Modules.Sum(m => m.Minutes), card.GetProperty("minutes").GetInt32());
        Assert.Equal("Test foreignmentor", card.GetProperty("mentorName").GetString());
    }

    [Fact]
    public async Task UserListPagesAreStableWhenNamesRepeat()
    {
        using (var scope = f.Services.CreateScope())
        {
            var users = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
            for (var i = 0; i < 51; i++)
            {
                var email = $"twin{i:D2}@test.invalid";
                Assert.True((await users.CreateAsync(new AppUser { Email = email, UserName = email, FullName = "Pagination Twin", Role = "Student" })).Succeeded);
            }
        }
        using var admin = await f.Login("admin");
        var first = await admin.GetFromJsonAsync<JsonElement>("/api/admin/users?search=Pagination%20Twin&page=1");
        var second = await admin.GetFromJsonAsync<JsonElement>("/api/admin/users?search=Pagination%20Twin&page=2");
        var ids = first.GetProperty("items").EnumerateArray().Concat(second.GetProperty("items").EnumerateArray())
            .Select(x => x.GetProperty("id").GetString()).ToArray();
        Assert.Equal(51, first.GetProperty("total").GetInt32());
        Assert.Equal(51, ids.Distinct().Count());
    }

    [Fact]
    public async Task SetupRefusesExistingBootstrapEmailAndUnknownOptions()
    {
        var environment = f.Services.GetRequiredService<IHostEnvironment>();
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Bootstrap:Email"] = "student@test.invalid",
            ["Bootstrap:Password"] = $"Bootstrap-{Guid.NewGuid():N}"
        }).Build();
        var existing = await Assert.ThrowsAsync<InvalidOperationException>(() => DatabaseSetup.Run(f.Services, config, environment, ["--bootstrap-admin"]));
        Assert.Contains("Bootstrap__Email already exists", existing.Message);
        var typo = await Assert.ThrowsAsync<InvalidOperationException>(() => DatabaseSetup.Run(f.Services, config, environment, ["--migrate", "--seed-contnet"]));
        Assert.Contains("--seed-contnet", typo.Message);
        Assert.True(DatabaseSetup.IsRequested(["--seed-contnet"]));
        Assert.False(DatabaseSetup.IsRequested(["--urls", "http://127.0.0.1:5080"]));
        using var scope = f.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal("Student", await db.Users.Where(u => u.Email == "student@test.invalid").Select(u => u.Role).SingleAsync());
    }
}

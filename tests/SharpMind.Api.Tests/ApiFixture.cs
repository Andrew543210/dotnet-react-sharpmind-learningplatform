using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using SharpMind.Api.Domain;
using SharpMind.Api.Infrastructure;

namespace SharpMind.Api.Tests;

public sealed class ApiFixture : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly string database = $"sharpmind_test_{Guid.NewGuid():N}";
    private readonly string password = $"Test-{Guid.NewGuid():N}";
    private string connection = "";
    private string adminConnection = "";
    public Curriculum Content { get; private set; } = null!;
    public int CourseId { get; private set; }
    public int OtherCourseId { get; private set; }
    public string StudentId { get; private set; } = "";
    public string OtherStudentId { get; private set; } = "";
    public string MediaRoot { get; } = Path.Combine(Path.GetTempPath(), $"sharpmind-test-media-{Guid.NewGuid():N}");
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    protected override void ConfigureWebHost(IWebHostBuilder builder) => builder.UseEnvironment("Testing")
        .UseSetting("ConnectionStrings:Database", connection).UseSetting("Media:RootPath", MediaRoot);

    public async Task InitializeAsync()
    {
        var configured = Environment.GetEnvironmentVariable("SHARPMIND_TEST_CONNECTION")
            ?? throw new InvalidOperationException("Set SHARPMIND_TEST_CONNECTION to a PostgreSQL connection with CREATE DATABASE permission. Tests create and drop only their random sharpmind_test_* database.");
        var admin = new NpgsqlConnectionStringBuilder(configured) { Database = "postgres", Pooling = false };
        adminConnection = admin.ConnectionString;
        await using (var c = new NpgsqlConnection(adminConnection))
        {
            await c.OpenAsync();
            await using var command = new NpgsqlCommand($"CREATE DATABASE \"{database}\"", c);
            await command.ExecuteNonQueryAsync();
        }
        connection = new NpgsqlConnectionStringBuilder(configured) { Database = database, IncludeErrorDetail = false }.ConnectionString;
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var ids = new Dictionary<string, string>();
        foreach (var (name, role) in new[] { ("student", "Student"), ("other", "Student"), ("mentor", "Mentor"), ("foreignmentor", "Mentor"), ("admin", "Admin") })
        {
            var user = new AppUser { Email = $"{name}@test.invalid", UserName = $"{name}@test.invalid", FullName = $"Test {name}", Role = role };
            var result = await users.CreateAsync(user, password);
            Assert.True(result.Succeeded); ids[name] = user.Id;
        }
        StudentId = ids["student"]; OtherStudentId = ids["other"];
        // ContentRootPath is resolved by WebApplicationFactory from the solution.
        var root = scope.ServiceProvider.GetRequiredService<Microsoft.Extensions.Hosting.IHostEnvironment>().ContentRootPath;
        var file = Path.Combine(root, "Content", "react-state-forms.json");
        var seed = JsonSerializer.Deserialize<CourseSeed>(await File.ReadAllTextAsync(file), Json)!;
        Content = seed.Content;
        var course = new Course { Slug = "test-react", Title = seed.Title, Description = seed.Description, MentorId = ids["mentor"], IsPublished = true };
        var other = new Course { Slug = "other-react", Title = "Another course", Description = seed.Description, MentorId = ids["foreignmentor"], IsPublished = true };
        course.SetCurriculum(Content); other.SetCurriculum(Content);
        db.Courses.AddRange(course, other); await db.SaveChangesAsync(); CourseId = course.Id; OtherCourseId = other.Id;
    }

    public async Task<HttpClient> Login(string name)
    {
        var client = CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        var response = await Send(client, "/api/auth/login", new { email = $"{name}@test.invalid", password });
        Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
        return client;
    }

    public async Task<HttpResponseMessage> Send(HttpClient client, string path, object? body = null, HttpMethod? method = null)
    {
        var csrf = await client.GetFromJsonAsync<JsonElement>("/api/auth/csrf");
        var request = new HttpRequestMessage(method ?? HttpMethod.Post, path);
        request.Headers.Add("X-CSRF-TOKEN", csrf.GetProperty("token").GetString());
        if (body is not null) request.Content = JsonContent.Create(body);
        return await client.SendAsync(request);
    }

    public async Task<int> Approve(HttpClient student, HttpClient mentor, int? courseId = null)
    {
        var id = courseId ?? CourseId;
        var response = await Send(student, $"/api/courses/{id}/enroll");
        response.EnsureSuccessStatusCode();
        var enrollment = await response.Content.ReadFromJsonAsync<JsonElement>();
        var enrollmentId = enrollment.GetProperty("id").GetInt32();
        (await Send(mentor, $"/api/staff/enrollments/{enrollmentId}/decision", new { status = "Approved", reason = "" })).EnsureSuccessStatusCode();
        return enrollmentId;
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        await base.DisposeAsync();
        NpgsqlConnection.ClearAllPools();
        await using var c = new NpgsqlConnection(adminConnection);
        await c.OpenAsync();
        if (!database.StartsWith("sharpmind_test_", StringComparison.Ordinal)) throw new InvalidOperationException("Unsafe test database name.");
        await using var command = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{database}\" WITH (FORCE)", c);
        await command.ExecuteNonQueryAsync();
        if (Directory.Exists(MediaRoot)) Directory.Delete(MediaRoot, true);
    }
}

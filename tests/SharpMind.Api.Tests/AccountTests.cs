using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace SharpMind.Api.Tests;

public sealed class AccountTests : IClassFixture<ApiFixture>
{
    private readonly ApiFixture f;
    public AccountTests(ApiFixture fixture) => f = fixture;

    [Fact]
    public async Task RegistrationNeverAcceptsClientAssignedPrivilegesAndValidatesPasswords()
    {
        using var client = f.CreateClient();
        var email = $"new-{Guid.NewGuid():N}@test.invalid";
        Assert.Equal(HttpStatusCode.BadRequest, (await f.Send(client, "/api/auth/register", new { email, password = "short", fullName = "New Learner", role = "Admin" })).StatusCode);
        var result = await f.Send(client, "/api/auth/register", new { email, password = $"Unique-{Guid.NewGuid():N}", fullName = "New Learner", role = "Admin" });
        result.EnsureSuccessStatusCode();
        var profile = await result.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Student", profile.GetProperty("role").GetString());
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/admin/users")).StatusCode);
    }

    [Fact]
    public async Task AdministrativeChangesRevokeExistingSessionsAndProtectTheActingAdmin()
    {
        using var admin = await f.Login("admin"); using var other = await f.Login("other");
        var own = await admin.GetFromJsonAsync<JsonElement>("/api/auth/me");
        Assert.Equal(HttpStatusCode.Conflict, (await f.Send(admin, $"/api/admin/users/{own.GetProperty("id").GetString()}", new { role = "Student", isDisabled = true }, HttpMethod.Put)).StatusCode);
        (await f.Send(admin, $"/api/admin/users/{f.OtherStudentId}", new { role = "Student", isDisabled = true }, HttpMethod.Put)).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Unauthorized, (await other.GetAsync("/api/support")).StatusCode);
        var login = await f.Send(other, "/api/auth/login", new { email = "other@test.invalid", password = "incorrect-but-long-password" });
        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
    }
}

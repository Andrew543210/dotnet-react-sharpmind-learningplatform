using Microsoft.Extensions.DependencyInjection;
using System.Net;

namespace SharpMind.Api.Tests;

public sealed class LockoutTests : IClassFixture<ApiFixture>
{
    private readonly ApiFixture f;
    public LockoutTests(ApiFixture fixture) => f = fixture;

    [Fact]
    public async Task RepeatedCredentialFailuresLockTheAccountWithoutRevealingItsExistence()
    {
        using var client = f.CreateClient();
        for (var i = 0; i < 5; i++)
        {
            var result = await f.Send(client, "/api/auth/login", new { email = "student@test.invalid", password = "wrong-but-long-password" });
            Assert.Equal(HttpStatusCode.Unauthorized, result.StatusCode);
        }
        using var scope = f.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<Microsoft.AspNetCore.Identity.UserManager<SharpMind.Api.Domain.AppUser>>();
        var user = await users.FindByIdAsync(f.StudentId);
        Assert.True(await users.IsLockedOutAsync(user!));
        var unknown = await f.Send(client, "/api/auth/login", new { email = "missing@test.invalid", password = "wrong-but-long-password" });
        Assert.Equal(HttpStatusCode.Unauthorized, unknown.StatusCode);
    }
}


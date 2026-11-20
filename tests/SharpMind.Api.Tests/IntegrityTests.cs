using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using SharpMind.Api.Infrastructure;

namespace SharpMind.Api.Tests;

public sealed class IntegrityTests : IClassFixture<ApiFixture>
{
    private readonly ApiFixture f;
    public IntegrityTests(ApiFixture fixture) => f = fixture;

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

using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SharpMind.Api.Domain;

namespace SharpMind.Api.Infrastructure;

public static class DatabaseSetup
{
    private static readonly string[] Commands = ["--migrate", "--seed-demo", "--seed-content", "--bootstrap-admin"];

    // Anything that looks like a setup option runs setup mode, so a typo fails loudly instead of starting the web server
    // or silently doing nothing.
    public static bool IsRequested(string[] args) => args.Any(x => x.StartsWith("--migrate", StringComparison.Ordinal)
        || x.StartsWith("--seed", StringComparison.Ordinal) || x.StartsWith("--bootstrap", StringComparison.Ordinal));

    public static async Task Run(IServiceProvider services, IConfiguration config, IHostEnvironment environment, string[] args)
    {
        var unknown = args.Where(x => IsRequested([x]) && !Commands.Contains(x)).ToArray();
        if (unknown.Length > 0)
            throw new InvalidOperationException($"Unknown setup option {string.Join(", ", unknown)}. Use {string.Join(", ", Commands)}.");
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        if (args.Contains("--migrate")) await db.Database.MigrateAsync();
        if (args.Contains("--bootstrap-admin"))
        {
            var email = config["Bootstrap:Email"] ?? throw new InvalidOperationException("Set Bootstrap__Email.");
            var password = config["Bootstrap:Password"] ?? throw new InvalidOperationException("Set Bootstrap__Password.");
            var name = config["Bootstrap:FullName"] ?? "Адміністратор";
            if (await users.FindByEmailAsync(email) is not null)
                throw new InvalidOperationException("An account with Bootstrap__Email already exists. Bootstrap does not modify existing users; choose another email.");
            if (await db.Users.AnyAsync(u => u.Role == "Admin")) throw new InvalidOperationException("An administrator already exists. Bootstrap does not modify existing users.");
            await CreateUser(users, email, name, "Admin", password);
            Console.WriteLine("Administrator account created.");
        }
        if (args.Contains("--seed-demo"))
        {
            if (environment.IsProduction()) throw new InvalidOperationException("Demo data is forbidden in Production.");
            var password = config["Demo:Password"] ?? throw new InvalidOperationException("Set Demo__Password (15–128 characters).");
            await CreateUser(users, "admin@demo.sharpmind.test", "Адміністратор демо", "Admin", password);
            await CreateUser(users, "mentor@demo.sharpmind.test", "Олександр Коваль", "Mentor", password);
            await CreateUser(users, "mentor2@demo.sharpmind.test", "Ірина Мельник", "Mentor", password);
            await CreateUser(users, "mentor3@demo.sharpmind.test", "Данило Бондар", "Mentor", password);
            await CreateUser(users, "mentor4@demo.sharpmind.test", "Софія Ткаченко", "Mentor", password);
            await CreateUser(users, "student@demo.sharpmind.test", "Марія Шевченко", "Student", password);
        }
        if (args.Contains("--seed-content"))
        {
            var mentorEmail = config["Content:MentorEmail"] ?? "mentor@demo.sharpmind.test";
            var mentor = await users.FindByEmailAsync(mentorEmail) ?? throw new InvalidOperationException("Create a mentor and set Content__MentorEmail before importing content.");
            if (mentor.Role is not ("Mentor" or "Admin") || mentor.IsDisabled) throw new InvalidOperationException("Content mentor must be active staff.");
            var directory = Path.Combine(environment.ContentRootPath, "Content");
            foreach (var file in Directory.GetFiles(directory, "*.json").Order())
            {
                var seed = JsonSerializer.Deserialize<CourseSeed>(await File.ReadAllTextAsync(file), Curriculum.JsonOptions) ?? throw new InvalidOperationException("Invalid course file.");
                var error = seed.Content.Validate();
                if (error is not null) throw new InvalidOperationException($"{Path.GetFileName(file)}: {error}");
                if (await db.Courses.AnyAsync(c => c.Slug == seed.Slug)) continue;
                var owner = mentor;
                if (args.Contains("--seed-demo"))
                {
                    var email = seed.Topic switch { "WebDevelopment" => "mentor2@demo.sharpmind.test", "DataScience" => "mentor3@demo.sharpmind.test", "DevOps" => "mentor4@demo.sharpmind.test", _ => mentorEmail };
                    owner = await users.FindByEmailAsync(email) ?? throw new InvalidOperationException("Missing demo mentor.");
                }
                db.Courses.Add(new Course
                {
                    Slug = seed.Slug,
                    Title = seed.Title,
                    Description = seed.Description,
                    Topic = seed.Topic,
                    Level = seed.Level,
                    MentorId = owner.Id,
                    CurriculumJson = seed.Content.ToJson(),
                    IsPublished = true
                });
            }
            await db.SaveChangesAsync();
        }
    }

    private static async Task CreateUser(UserManager<AppUser> users, string email, string name, string role, string password)
    {
        if (await users.FindByEmailAsync(email) is not null) return;
        if (password.Length is < 15 or > 128) throw new InvalidOperationException("Password must contain 15–128 characters.");
        var result = await users.CreateAsync(new AppUser { UserName = email, Email = email, FullName = name, Role = role }, password);
        if (!result.Succeeded) throw new InvalidOperationException("Unable to create account. Check the configured credentials.");
    }
}

public sealed record CourseSeed(string Slug, string Title, string Description, string Topic, string Level, Curriculum Content);

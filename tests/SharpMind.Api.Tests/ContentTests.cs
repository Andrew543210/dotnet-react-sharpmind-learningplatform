using System.Text.Json;
using SharpMind.Api.Domain;
using SharpMind.Api.Infrastructure;

namespace SharpMind.Api.Tests;

public sealed class ContentTests
{
    [Fact]
    public void TenCompleteProgrammesContainSubstantialLessonsAndTenQuestionAssessments()
    {
        var directory = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../src/SharpMind.Api/Content"));
        var files = Directory.GetFiles(directory, "*.json");
        Assert.Equal(10, files.Length);
        foreach (var file in files)
        {
            var course = JsonSerializer.Deserialize<CourseSeed>(File.ReadAllText(file), Curriculum.JsonOptions)!;
            Assert.Null(course.Content.Validate());
            Assert.Equal(10, course.Content.FinalQuestions.Length);
            Assert.Equal(2, course.Content.Modules.Length);
            foreach (var module in course.Content.Modules)
            {
                Assert.True(module.Lesson.Length >= 4500, $"{course.Slug}/{module.Key} needs substantial teaching material.");
                Assert.Contains("## ", module.Lesson);
                Assert.Contains("```", module.Lesson);
                Assert.Contains("## Відео англійською", module.Lesson);
                Assert.Contains("https://", module.Lesson);
                Assert.Contains("40 балів", module.Practice);
                Assert.Equal(10, module.Questions.Length);
                Assert.DoesNotContain("placeholder", module.Lesson, StringComparison.OrdinalIgnoreCase);
                Assert.DoesNotContain("Option 1", string.Join(" ", module.Questions.SelectMany(q => q.Options)));
            }
        }
    }
}

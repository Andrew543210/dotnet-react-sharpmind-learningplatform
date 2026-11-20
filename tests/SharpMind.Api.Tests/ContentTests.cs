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

    [Fact]
    public void OptionLengthDoesNotGiveAwayEnoughAnswersToPass()
    {
        foreach (var course in Courses())
        {
            var assessments = course.Content.Modules.Select(m => (m.Key, m.Questions)).Append(("final", course.Content.FinalQuestions));
            foreach (var (key, questions) in assessments)
            {
                // Ties count in the learner's favour, so this is the best score a length-only guess can reach.
                var longest = Score(questions, lengths => lengths.Max());
                var shortest = Score(questions, lengths => lengths.Min());
                Assert.True(longest < LearningRules.PassScore(key), $"{course.Slug}/{key}: choosing the longest option scores {longest}%.");
                Assert.True(shortest < LearningRules.PassScore(key), $"{course.Slug}/{key}: choosing the shortest option scores {shortest}%.");
            }
        }
    }

    private static int Score(Question[] questions, Func<int[], int> pick) =>
        LearningRules.Score(questions, questions.ToDictionary(q => q.Id, q =>
        {
            var lengths = q.Options.Select(o => o.Length).ToArray();
            var target = pick(lengths);
            return lengths[q.Correct] == target ? q.Correct : Array.IndexOf(lengths, target);
        }));

    private static IEnumerable<CourseSeed> Courses()
    {
        var directory = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../src/SharpMind.Api/Content"));
        return Directory.GetFiles(directory, "*.json").Select(file => JsonSerializer.Deserialize<CourseSeed>(File.ReadAllText(file), Curriculum.JsonOptions)!);
    }
}

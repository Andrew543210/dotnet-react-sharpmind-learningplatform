using SharpMind.Api.Domain;

namespace SharpMind.Api.Tests;

public sealed class LearningRulesTests
{
    private static Question[] Questions => Enumerable.Range(1, 10).Select(i => new Question($"q{i}", $"Question {i}", ["A", "B", "C", "D"], i % 4, "Explanation")).ToArray();

    [Theory]
    [InlineData(0, 0)] [InlineData(7, 70)] [InlineData(8, 80)] [InlineData(10, 100)]
    public void ScoreReflectsCorrectAnswers(int correct, int expected)
    {
        var questions = Questions;
        var answers = questions.Select((q, i) => new { q.Id, Value = i < correct ? q.Correct : (q.Correct + 1) % 4 }).ToDictionary(x => x.Id, x => x.Value);
        Assert.Equal(expected, LearningRules.Score(questions, answers));
    }

    [Fact]
    public void MissingForeignAndOutOfRangeAnswersAreRejected()
    {
        var answers = Questions.ToDictionary(q => q.Id, q => q.Correct);
        answers.Remove("q1"); Assert.Throws<RuleException>(() => LearningRules.Score(Questions, answers));
        answers["other"] = 0; Assert.Throws<RuleException>(() => LearningRules.Score(Questions, answers));
        answers.Remove("other"); answers["q1"] = 4; Assert.Throws<RuleException>(() => LearningRules.Score(Questions, answers));
    }

    [Fact]
    public void EveryModuleRequiresReadingQuizAndPassingPractice()
    {
        ModuleStatus[] complete = [new("first", true, 70, 60), new("second", true, 80, 90)];
        Assert.True(LearningRules.ModulesComplete(complete));
        Assert.False(LearningRules.ModulesComplete([complete[0] with { Read = false }, complete[1]]));
        Assert.False(LearningRules.ModulesComplete([complete[0] with { QuizScore = 60 }, complete[1]]));
        Assert.False(LearningRules.ModulesComplete([complete[0] with { PracticeGrade = 59 }, complete[1]]));
        Assert.False(LearningRules.ModulesComplete([]));
        Assert.Equal(85, LearningRules.Progress(complete, 0));
        Assert.Equal(100, LearningRules.Progress(complete, 80));
    }
}

using System.Text.Json;

namespace SharpMind.Api.Domain;

public sealed record Question(string Id, string Text, string[] Options, int Correct, string Explanation);
public sealed record CourseModule(string Key, string Title, int Minutes, string Lesson, string Practice, Question[] Questions);
public sealed record Curriculum(string[] Outcomes, string Prerequisites, CourseModule[] Modules, Question[] FinalQuestions)
{
    public static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    public string ToJson() => JsonSerializer.Serialize(this, JsonOptions);
    public static Curriculum FromJson(string json) => JsonSerializer.Deserialize<Curriculum>(json, JsonOptions)
        ?? throw new InvalidOperationException("Missing curriculum.");

    public string? Validate()
    {
        if (Outcomes is not { Length: >= 2 and <= 12 } || Outcomes.Any(x => string.IsNullOrWhiteSpace(x) || x.Length > 500)
            || string.IsNullOrWhiteSpace(Prerequisites) || Prerequisites.Length > 2000)
            return "Укажіть передумови та від 2 до 12 результатів навчання.";
        if (Modules is not { Length: >= 2 and <= 20 }) return "Курс повинен містити від 2 до 20 модулів.";
        if (Modules.Any(m => m is null || string.IsNullOrWhiteSpace(m.Key) || m.Key.Length > 60
            || !System.Text.RegularExpressions.Regex.IsMatch(m.Key, "^[a-z0-9-]+$")
            || string.IsNullOrWhiteSpace(m.Title) || m.Title.Length > 160 || m.Minutes is < 20 or > 1200
            || string.IsNullOrWhiteSpace(m.Lesson) || m.Lesson.Length is < 1200 or > 40000
            || string.IsNullOrWhiteSpace(m.Practice) || m.Practice.Length is < 300 or > 12000))
            return "Кожному модулю потрібні унікальний ключ, назва, повний урок і практична робота з критеріями.";
        if (Modules.Select(m => m.Key).Distinct().Count() != Modules.Length || Modules.Any(m => m.Key == "final"))
            return "Ключі модулів мають бути унікальними; final зарезервовано.";
        foreach (var questions in Modules.Select(m => m.Questions).Append(FinalQuestions))
        {
            if (questions is not { Length: 10 }) return "Кожен тест має містити рівно 10 питань.";
            if (questions.Any(q => q is null || string.IsNullOrWhiteSpace(q.Id) || q.Id.Length > 60
                || string.IsNullOrWhiteSpace(q.Text) || q.Text.Length > 1000
                || q.Options is not { Length: 4 } || q.Options.Any(o => string.IsNullOrWhiteSpace(o) || o.Length > 1000)
                || q.Options.Distinct().Count() != 4 || q.Correct is < 0 or > 3
                || string.IsNullOrWhiteSpace(q.Explanation) || q.Explanation.Length > 2000))
                return "Питання потребує 4 різних відповідей, правильної відповіді та пояснення.";
            if (questions.Select(q => q.Id).Distinct().Count() != 10 || questions.Select(q => q.Text).Distinct().Count() != 10)
                return "Питання в тесті не можуть повторюватися.";
        }
        return null;
    }
}

public static class LearningRules
{
    public const int ModulePass = 70;
    public const int PracticePass = 60;
    public const int FinalPass = 80;
    public const int QuizCooldownSeconds = 60;

    public static int PassScore(string assessmentKey) => assessmentKey == "final" ? FinalPass : ModulePass;
    public static int DailyAttempts(string assessmentKey) => assessmentKey == "final" ? 5 : 10;

    public static int Score(Question[] questions, IReadOnlyDictionary<string, int> answers)
    {
        if (answers.Count != questions.Length || questions.Any(q => !answers.TryGetValue(q.Id, out var answer) || answer is < 0 or > 3))
            throw new RuleException(400, "Дайте одну відповідь на кожне питання тесту.");
        return questions.Count(q => answers[q.Id] == q.Correct) * 100 / questions.Length;
    }

    public static bool ModulesComplete(IEnumerable<ModuleStatus> modules) => modules.Any() && modules.All(m => m.Read && m.QuizScore >= ModulePass && m.PracticeGrade >= PracticePass);
    public static int Progress(ModuleStatus[] modules, int finalScore) => modules.Length == 0 ? 0
        : (modules.Sum(m => (m.Read ? 1 : 0) + (m.QuizScore >= ModulePass ? 1 : 0) + (m.PracticeGrade >= PracticePass ? 1 : 0))
        + (finalScore >= FinalPass ? 1 : 0)) * 100 / (modules.Length * 3 + 1);
}

public sealed record ModuleStatus(string Key, bool Read, int QuizScore, int PracticeGrade);
public sealed class RuleException(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}

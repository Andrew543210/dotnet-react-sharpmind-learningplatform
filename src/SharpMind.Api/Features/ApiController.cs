using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using SharpMind.Api.Domain;

namespace SharpMind.Api.Features;

[ApiController]
public abstract class ApiController : ControllerBase
{
    protected string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? throw new RuleException(401, "Увійдіть до облікового запису.");
    protected bool IsAdmin => User.IsInRole("Admin");
    protected static RuleException Missing() => new(404, "Запис не знайдено або доступ відсутній.");
    protected static void Require([System.Diagnostics.CodeAnalysis.DoesNotReturnIf(false)] bool condition, string message, int status = 400)
    {
        if (!condition) throw new RuleException(status, message);
    }
}

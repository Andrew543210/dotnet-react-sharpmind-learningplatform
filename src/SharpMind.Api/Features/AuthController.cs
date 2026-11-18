using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using SharpMind.Api.Domain;

namespace SharpMind.Api.Features;

[Route("api/auth")]
public sealed class AuthController(UserManager<AppUser> users, SignInManager<AppUser> signIn) : ApiController
{
    private static readonly AppUser TimingUser = new();
    private static readonly string TimingHash = new PasswordHasher<AppUser>().HashPassword(TimingUser, Guid.NewGuid().ToString());

    [HttpGet("csrf")]
    public object Csrf(IAntiforgery antiforgery) => new { token = antiforgery.GetAndStoreTokens(HttpContext).RequestToken };

    [HttpGet("me")]
    public async Task<object?> Me() => User.Identity?.IsAuthenticated != true ? null : Profile(await users.GetUserAsync(User) ?? throw Missing());

    [HttpPost("register"), EnableRateLimiting("auth")]
    public async Task<object> Register(RegisterRequest request)
    {
        Require(User.Identity?.IsAuthenticated != true, "Спершу вийдіть з поточного облікового запису.", 409);
        Require(request.FullName.Trim().Length >= 2, "Укажіть повне ім’я.");
        var user = new AppUser { UserName = request.Email.Trim(), Email = request.Email.Trim(), FullName = request.FullName.Trim() };
        var result = await users.CreateAsync(user, request.Password);
        Require(result.Succeeded, "Не вдалося зареєструватися. Перевірте дані або скористайтеся входом.");
        await signIn.SignInAsync(user, false);
        return Profile(user);
    }

    [HttpPost("login"), EnableRateLimiting("auth")]
    public async Task<object> Login(LoginRequest request)
    {
        var user = await users.FindByEmailAsync(request.Email.Trim());
        if (user is null)
        {
            _ = new PasswordHasher<AppUser>().VerifyHashedPassword(TimingUser, TimingHash, request.Password);
            throw new RuleException(401, "Невірні дані входу або вхід тимчасово недоступний.");
        }
        var result = await signIn.CheckPasswordSignInAsync(user, request.Password, true);
        Require(result.Succeeded && !user.IsDisabled, "Невірні дані входу або вхід тимчасово недоступний.", 401);
        await signIn.SignInAsync(user, false);
        return Profile(user);
    }

    [Authorize, HttpPost("logout")]
    public async Task<IActionResult> Logout() { await signIn.SignOutAsync(); return NoContent(); }

    [Authorize, HttpPost("password"), EnableRateLimiting("auth")]
    public async Task<IActionResult> Password(PasswordRequest request)
    {
        var user = await users.GetUserAsync(User) ?? throw Missing();
        Require((await users.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword)).Succeeded,
            "Перевірте поточний пароль. Новий пароль має містити 15–128 символів.");
        await signIn.RefreshSignInAsync(user);
        return NoContent();
    }

    private static object Profile(AppUser u) => new { u.Id, u.FullName, u.Email, u.Role };
}

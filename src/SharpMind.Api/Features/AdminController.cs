using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SharpMind.Api.Domain;
using SharpMind.Api.Infrastructure;

namespace SharpMind.Api.Features;

[Authorize(Roles = "Admin"), Route("api/admin")]
public sealed class AdminController(AppDbContext db, UserManager<AppUser> users) : ApiController
{
    [HttpGet("users")]
    public async Task<object> Users([FromQuery] string? search, [FromQuery] int page = 1)
    {
        Require(page is > 0 and <= 10000 && (search?.Length ?? 0) <= 100, "Невірні параметри пошуку.");
        var query = db.Users.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(u => u.FullName.ToLower().Contains(search.ToLower()) || u.Email!.ToLower().Contains(search.ToLower()));
        return new { total = await query.CountAsync(), items = await query.OrderBy(u => u.FullName).Skip((page - 1) * 50).Take(50)
            .Select(u => new { u.Id, u.FullName, u.Email, u.Role, u.IsDisabled }).ToListAsync() };
    }

    [HttpPut("users/{id}")]
    public async Task<IActionResult> UpdateUser(string id, UserUpdate request)
    {
        Require(id != UserId, "Не можна змінювати власні права або блокувати себе.", 409);
        var user = await users.FindByIdAsync(id) ?? throw Missing();
        Require(!await db.Courses.AnyAsync(c => c.MentorId == id && !c.IsArchived) || request.Role is "Mentor" or "Admin" && !request.IsDisabled,
            "Спочатку перепризначте або архівуйте курси цього ментора.", 409);
        user.Role = request.Role; user.IsDisabled = request.IsDisabled;
        Require((await users.UpdateAsync(user)).Succeeded, "Не вдалося змінити обліковий запис.", 409);
        await users.UpdateSecurityStampAsync(user);
        return NoContent();
    }

    [HttpGet("mentors")]
    public async Task<object> Mentors() => await db.Users.Where(u => !u.IsDisabled && (u.Role == "Mentor" || u.Role == "Admin"))
        .Select(u => new { u.Id, u.FullName }).ToListAsync();

    [HttpPost("courses/{id:int}/mentor")]
    public async Task<IActionResult> Assign(int id, AssignmentRequest request)
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        var course = await db.LockCourse(id) ?? throw Missing();
        Require(course.Version == request.Version, "Курс змінено. Оновіть сторінку.", 409);
        Require(await db.Users.AnyAsync(u => u.Id == request.MentorId && !u.IsDisabled && (u.Role == "Mentor" || u.Role == "Admin")), "Оберіть активного ментора.");
        course.MentorId = request.MentorId; course.Version++;
        await db.SaveChangesAsync(); await tx.CommitAsync();
        return NoContent();
    }
}

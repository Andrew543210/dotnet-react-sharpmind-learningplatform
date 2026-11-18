using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SharpMind.Api.Domain;
using SharpMind.Api.Infrastructure;

namespace SharpMind.Api.Features;

[Authorize, Route("api/support")]
public sealed class SupportController(AppDbContext db) : ApiController
{
    [HttpGet]
    public async Task<object> List() => await db.SupportTickets.Where(t => IsAdmin || t.UserId == UserId)
        .OrderByDescending(t => t.CreatedAt).Take(100).Select(t => new { t.Id, t.Subject, t.Message, t.Reply, t.CreatedAt, t.ResolvedAt,
            userName = t.User.FullName }).ToListAsync();

    [HttpPost]
    public async Task<object> Create(TicketRequest request)
    {
        Require(request.RequestId != Guid.Empty && request.Subject.Trim().Length >= 5 && request.Message.Trim().Length >= 20, "Заповніть тему та повідомлення.");
        var existing = await db.SupportTickets.FindAsync(request.RequestId);
        if (existing is not null)
        {
            Require(existing.UserId == UserId && existing.Subject == request.Subject.Trim() && existing.Message == request.Message.Trim(), "Ідентифікатор звернення вже використано.", 409);
            return new { existing.Id };
        }
        Require(await db.SupportTickets.CountAsync(t => t.UserId == UserId && t.CreatedAt > DateTime.UtcNow.AddDays(-1)) < 10, "Дозволено до 10 звернень за 24 години.", 429);
        var ticket = new SupportTicket { Id = request.RequestId, UserId = UserId, Subject = request.Subject.Trim(), Message = request.Message.Trim() };
        db.SupportTickets.Add(ticket); await db.SaveChangesAsync();
        return new { ticket.Id };
    }

    [Authorize(Roles = "Admin"), HttpPost("{id:guid}/reply")]
    public async Task<IActionResult> Reply(Guid id, ReplyRequest request)
    {
        Require(request.Reply.Trim().Length >= 20, "Додайте змістовну відповідь.");
        var count = await db.SupportTickets.Where(t => t.Id == id && t.ResolvedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.Reply, request.Reply.Trim()).SetProperty(t => t.ResolvedAt, DateTime.UtcNow));
        if (count == 0)
        {
            var ticket = await db.SupportTickets.FindAsync(id) ?? throw Missing();
            Require(ticket.Reply == request.Reply.Trim(), "На звернення вже відповіли. Оновіть список.", 409);
        }
        return NoContent();
    }
}

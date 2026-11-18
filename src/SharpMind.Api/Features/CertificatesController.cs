using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SharpMind.Api.Infrastructure;

namespace SharpMind.Api.Features;

[Route("api/certificates")]
public sealed class CertificatesController(AppDbContext db) : ApiController
{
    [HttpGet("{id:guid}")]
    public async Task<object> Verify(Guid id) => await db.Certificates.AsNoTracking().Where(c => c.Id == id)
        .Select(c => new { c.Id, c.FullName, c.CourseTitle, c.MentorName, c.FinalScore, c.IssuedAt }).SingleOrDefaultAsync() ?? throw Missing();
}

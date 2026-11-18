using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SharpMind.Api.Domain;
using SharpMind.Api.Infrastructure;

namespace SharpMind.Api.Features;

[Authorize, Route("api/media")]
public sealed class MediaController(AppDbContext db, IConfiguration config, IHostEnvironment environment) : ApiController
{
    private string Root => Path.GetFullPath(config["Media:RootPath"] ?? Path.Combine(environment.ContentRootPath, "data", "media"));

    [Authorize(Roles = "Mentor,Admin"), HttpGet("course/{courseId:int}")]
    public async Task<object> List(int courseId)
    {
        Require(await db.Courses.AnyAsync(c => c.Id == courseId && (c.MentorId == UserId || IsAdmin)), "Курс не знайдено.", 404);
        return await db.CourseMedia.Where(x => x.CourseId == courseId).OrderBy(x => x.CreatedAt)
            .Select(x => new { x.Id, x.ModuleKey, x.Title, x.ContentType, x.Transcript, x.Length }).ToListAsync();
    }

    [Authorize(Roles = "Mentor,Admin"), HttpPost("course/{courseId:int}/modules/{key}")]
    [RequestSizeLimit(106_000_000), RequestFormLimits(MultipartBodyLengthLimit = 106_000_000)]
    public async Task<object> Upload(int courseId, string key, [FromForm] IFormFile file, [FromForm] string title, [FromForm] string? transcript)
    {
        Require(!string.IsNullOrWhiteSpace(title) && title.Trim().Length <= 160, "Додайте підпис або опис для доступності (до 160 символів).");
        Require(file.Length is > 0 and <= 104_857_600, "Максимум 100 МіБ для відео та 5 МіБ для зображення.");
        await using var tx = await db.Database.BeginTransactionAsync();
        var course = await db.LockCourse(courseId) ?? throw Missing();
        Require(IsAdmin || course.MentorId == UserId, "Курс не знайдено.", 404);
        Require(!await db.Enrollments.AnyAsync(e => e.CourseId == courseId && e.Status == "Approved"), "Матеріали курсу вже використовуються. Створіть нову версію курсу.", 409);
        Require(Curriculum.FromJson(course.CurriculumJson).Modules.Any(m => m.Key == key), "Спочатку збережіть модуль.", 409);
        Require(await db.CourseMedia.CountAsync(x => x.CourseId == courseId) < 100, "До курсу можна додати до 100 медіафайлів.");
        await using var input = file.OpenReadStream();
        var header = new byte[16];
        var count = await input.ReadAtLeastAsync(header, 12, false, HttpContext.RequestAborted);
        var mime = MediaType(header.AsSpan(0, count));
        Require(mime is not null, "Дозволено лише PNG, JPEG, WebP, MP4 та WebM із відповідною сигнатурою файла.");
        Require(!mime!.StartsWith("image/", StringComparison.Ordinal) || file.Length <= 5_242_880, "Зображення має бути не більше 5 МіБ.");
        Require((transcript?.Length ?? 0) <= 12000 && (!mime.StartsWith("video/", StringComparison.Ordinal) || (transcript?.Trim().Length ?? 0) >= 40),
            "Для відео додайте текстову версію або докладний конспект (40–12000 символів).");
        var media = new CourseMedia { CourseId = courseId, ModuleKey = key, Title = title.Trim(), ContentType = mime, Transcript = transcript?.Trim() ?? "", Length = file.Length };
        Directory.CreateDirectory(Root);
        var path = Path.Combine(Root, media.Id.ToString("N"));
        try
        {
            await using (var output = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, true))
            {
                await output.WriteAsync(header.AsMemory(0, count), HttpContext.RequestAborted);
                await input.CopyToAsync(output, HttpContext.RequestAborted);
            }
            db.CourseMedia.Add(media);
            await db.SaveChangesAsync(); await tx.CommitAsync();
        }
        catch { System.IO.File.Delete(path); throw; }
        return new { media.Id, media.Title, media.ContentType, media.Length, media.ModuleKey };
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Read(Guid id)
    {
        var media = await db.CourseMedia.AsNoTracking().Include(x => x.Course).SingleOrDefaultAsync(x => x.Id == id) ?? throw Missing();
        Require(IsAdmin || media.Course.MentorId == UserId || await db.Enrollments.AnyAsync(e => e.CourseId == media.CourseId && e.StudentId == UserId && e.Status == "Approved"),
            "Файл не знайдено.", 404);
        var path = Path.Combine(Root, media.Id.ToString("N"));
        if (!System.IO.File.Exists(path)) throw new RuleException(404, "Файл недоступний. Зверніться до підтримки.");
        Response.Headers.CacheControl = "private, no-store";
        Response.Headers["Content-Disposition"] = "inline";
        return PhysicalFile(path, media.ContentType, enableRangeProcessing: true);
    }

    [Authorize(Roles = "Mentor,Admin"), HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var media = await db.CourseMedia.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id) ?? throw Missing();
        await using var tx = await db.Database.BeginTransactionAsync();
        var course = await db.LockCourse(media.CourseId) ?? throw Missing();
        Require(IsAdmin || course.MentorId == UserId, "Файл не знайдено.", 404);
        Require(!await db.Enrollments.AnyAsync(e => e.CourseId == course.Id && e.Status == "Approved"), "Матеріали курсу вже використовуються.", 409);
        await db.CourseMedia.Where(x => x.Id == id).ExecuteDeleteAsync();
        await tx.CommitAsync();
        System.IO.File.Delete(Path.Combine(Root, media.Id.ToString("N")));
        return NoContent();
    }

    internal static string? MediaType(ReadOnlySpan<byte> header)
    {
        if (header.Length >= 8 && header[..8].SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 })) return "image/png";
        if (header.Length >= 3 && header[0] == 255 && header[1] == 216 && header[2] == 255) return "image/jpeg";
        if (header.Length >= 12 && header[..4].SequenceEqual("RIFF"u8) && header.Slice(8, 4).SequenceEqual("WEBP"u8)) return "image/webp";
        if (header.Length >= 12 && header.Slice(4, 4).SequenceEqual("ftyp"u8)) return "video/mp4";
        if (header.Length >= 4 && header[..4].SequenceEqual(new byte[] { 26, 69, 223, 163 })) return "video/webm";
        return null;
    }
}

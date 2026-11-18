using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace SharpMind.Api.Tests;

public sealed class MediaTests : IClassFixture<ApiFixture>
{
    private readonly ApiFixture f;
    public MediaTests(ApiFixture fixture) => f = fixture;

    [Fact]
    public async Task UploadChecksOwnershipTypePrivateReadRangeAndCurriculumLock()
    {
        using var mentor = await f.Login("mentor"); using var otherMentor = await f.Login("foreignmentor");
        using var student = await f.Login("student"); using var other = await f.Login("other");
        var image = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jO0YAAAAASUVORK5CYII=");
        Assert.Equal(HttpStatusCode.NotFound, (await Upload(otherMentor, f.CourseId, image, "image.png")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Upload(mentor, f.CourseId, "<svg onload='x'/>"u8.ToArray(), "image.png")).StatusCode);
        var uploaded = await Upload(mentor, f.CourseId, image, "../../image.png"); uploaded.EnsureSuccessStatusCode();
        var id = (await uploaded.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        Assert.Equal(HttpStatusCode.Unauthorized, (await f.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false }).GetAsync($"/api/media/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"/api/media/{id}")).StatusCode);
        await f.Approve(student, mentor);
        var visible = await student.GetAsync($"/api/media/{id}"); visible.EnsureSuccessStatusCode();
        Assert.Equal("image/png", visible.Content.Headers.ContentType!.MediaType);
        Assert.Equal(image, await visible.Content.ReadAsByteArrayAsync());
        var range = new HttpRequestMessage(HttpMethod.Get, $"/api/media/{id}"); range.Headers.Range = new RangeHeaderValue(0, 7);
        var ranged = await student.SendAsync(range); Assert.Equal(HttpStatusCode.PartialContent, ranged.StatusCode);
        Assert.Equal(8, (await ranged.Content.ReadAsByteArrayAsync()).Length);
        Assert.Equal(HttpStatusCode.Conflict, (await Upload(mentor, f.CourseId, image, "second.png")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await f.Send(otherMentor, $"/api/media/{id}", method: HttpMethod.Delete)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await f.Send(mentor, $"/api/media/{id}", method: HttpMethod.Delete)).StatusCode);
        Assert.Single(Directory.GetFiles(f.MediaRoot));
        Assert.All(Directory.GetFiles(f.MediaRoot), path => Assert.Matches("^[a-f0-9]{32}$", Path.GetFileName(path)));
    }

    [Fact]
    public async Task VideoRequiresTextAlternativeAndCanBeRemovedBeforeEnrollment()
    {
        using var mentor = await f.Login("foreignmentor");
        byte[] header = [0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0];
        Assert.Equal(HttpStatusCode.BadRequest, (await Upload(mentor, f.OtherCourseId, header, "lesson.mp4")).StatusCode);
        var result = await Upload(mentor, f.OtherCourseId, header, "lesson.mp4", "This is a test-only MP4 signature, not a playable educational video. It verifies the upload contract."); result.EnsureSuccessStatusCode();
        var id = (await result.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        (await f.Send(mentor, $"/api/media/{id}", method: HttpMethod.Delete)).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.NotFound, (await mentor.GetAsync($"/api/media/{id}")).StatusCode);
    }

    private async Task<HttpResponseMessage> Upload(HttpClient client, int courseId, byte[] bytes, string filename, string? transcript = null)
    {
        var csrf = await client.GetFromJsonAsync<JsonElement>("/api/auth/csrf");
        using var multipart = new MultipartFormDataContent();
        multipart.Add(new ByteArrayContent(bytes), "file", filename);
        multipart.Add(new StringContent("An accessible description of the learning material"), "title");
        if (transcript is not null) multipart.Add(new StringContent(transcript), "transcript");
        var request = new HttpRequestMessage(HttpMethod.Post, $"/api/media/course/{courseId}/modules/state") { Content = multipart };
        request.Headers.Add("X-CSRF-TOKEN", csrf.GetProperty("token").GetString());
        return await client.SendAsync(request);
    }
}

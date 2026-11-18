using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using SharpMind.Api.Domain;
using SharpMind.Api.Infrastructure;
using Microsoft.AspNetCore.HttpOverrides;

if (args.Contains("--healthcheck"))
{
    try { using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(3) }; Environment.Exit((await http.GetAsync("http://localhost:8080/api/health/ready")).IsSuccessStatusCode ? 0 : 1); }
    catch { Environment.Exit(1); }
    return;
}

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 1_048_576);
builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(
    builder.Configuration.GetConnectionString("Database") ?? throw new InvalidOperationException("Set ConnectionStrings__Database.")));
builder.Services.AddIdentityCore<AppUser>(o =>
{
    o.User.RequireUniqueEmail = true;
    o.Password.RequiredLength = 15;
    o.Password.RequireDigit = false;
    o.Password.RequireUppercase = false;
    o.Password.RequireLowercase = false;
    o.Password.RequireNonAlphanumeric = false;
    o.Lockout.MaxFailedAccessAttempts = 5;
    o.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
}).AddEntityFrameworkStores<AppDbContext>().AddSignInManager().AddDefaultTokenProviders()
    .AddClaimsPrincipalFactory<RoleClaimsFactory>();
builder.Services.AddAuthentication(IdentityConstants.ApplicationScheme).AddIdentityCookies();
builder.Services.ConfigureApplicationCookie(o =>
{
    o.Cookie.Name = "SharpMind.Session";
    o.Cookie.HttpOnly = true;
    o.Cookie.SameSite = SameSiteMode.Lax;
    o.Cookie.SecurePolicy = builder.Environment.IsDevelopment() || builder.Environment.IsEnvironment("Testing")
        ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
    o.ExpireTimeSpan = TimeSpan.FromHours(8);
    o.SlidingExpiration = false;
    o.Events.OnRedirectToLogin = ctx => { ctx.Response.StatusCode = 401; return Task.CompletedTask; };
    o.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = 403; return Task.CompletedTask; };
});
builder.Services.Configure<SecurityStampValidatorOptions>(o => o.ValidationInterval = TimeSpan.Zero);
builder.Services.AddAuthorization();
builder.Services.AddAntiforgery(o =>
{
    o.HeaderName = "X-CSRF-TOKEN";
    o.Cookie.Name = "SharpMind.Csrf";
    o.Cookie.SameSite = SameSiteMode.Strict;
    o.Cookie.SecurePolicy = builder.Environment.IsDevelopment() || builder.Environment.IsEnvironment("Testing")
        ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
});
var protection = builder.Services.AddDataProtection().SetApplicationName("SharpMind");
var keyPath = builder.Configuration["DataProtection:KeyPath"];
if (!string.IsNullOrWhiteSpace(keyPath)) protection.PersistKeysToFileSystem(new DirectoryInfo(keyPath));
else if (builder.Environment.IsProduction()) throw new InvalidOperationException("Set DataProtection__KeyPath to a durable, access-restricted directory.");
builder.Services.AddControllers();
builder.Services.AddScoped<SharpMind.Api.Features.LearningService>();
builder.Services.AddProblemDetails();
var proxyAddress = builder.Configuration["ReverseProxy:Address"];
if (!string.IsNullOrWhiteSpace(proxyAddress))
{
    if (!System.Net.IPAddress.TryParse(proxyAddress, out var proxyIp)) throw new InvalidOperationException("ReverseProxy__Address must be the trusted proxy IP address.");
    builder.Services.Configure<ForwardedHeadersOptions>(o =>
    {
        o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
        o.KnownIPNetworks.Clear(); o.KnownProxies.Clear(); o.KnownProxies.Add(proxyIp);
        o.ForwardLimit = 1;
    });
}
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    o.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
        RateLimitPartition.GetFixedWindowLimiter(ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = 200, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    o.AddPolicy("auth", ctx => RateLimitPartition.GetFixedWindowLimiter(ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 12, Window = TimeSpan.FromMinutes(5), QueueLimit = 0 }));
    o.OnRejected = async (ctx, ct) =>
    {
        ctx.HttpContext.Response.Headers.RetryAfter = "60";
        await ctx.HttpContext.Response.WriteAsJsonAsync(new { title = "Забагато запитів. Спробуйте пізніше." }, ct);
    };
});

var app = builder.Build();
if (args.Any(x => x.StartsWith("--migrate", StringComparison.Ordinal) || x.StartsWith("--seed-", StringComparison.Ordinal) || x == "--bootstrap-admin"))
{
    await DatabaseSetup.Run(app.Services, app.Configuration, app.Environment, args);
    return;
}
if (!string.IsNullOrWhiteSpace(proxyAddress)) app.UseForwardedHeaders();
if (!app.Environment.IsDevelopment() && !app.Environment.IsEnvironment("Testing"))
{
    app.UseHsts();
    app.UseWhen(ctx => !ctx.Request.Path.StartsWithSegments("/api/health"), branch => branch.UseHttpsRedirection());
}
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers.XContentTypeOptions = "nosniff";
    ctx.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    ctx.Response.Headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
    ctx.Response.Headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
    if (ctx.Request.Path.StartsWithSegments("/api")) ctx.Response.Headers.CacheControl = "no-store";
    try { await next(); }
    catch (RuleException ex) { await Results.Problem(ex.Message, statusCode: ex.Status, title: ex.Message).ExecuteAsync(ctx); }
    catch (AntiforgeryValidationException) { await Results.Problem(statusCode: 400, title: "Оновіть сторінку та повторіть дію.").ExecuteAsync(ctx); }
    catch (BadHttpRequestException ex) { await Results.Problem(statusCode: ex.StatusCode, title: "Некоректний або завеликий запит.").ExecuteAsync(ctx); }
    catch (OperationCanceledException) when (ctx.RequestAborted.IsCancellationRequested) { ctx.Response.StatusCode = 499; }
    catch (DbUpdateConcurrencyException) { await Results.Problem(statusCode: 409, title: "Дані змінилися. Оновіть сторінку.").ExecuteAsync(ctx); }
    catch (DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException { SqlState: "23505" })
    { await Results.Problem(statusCode: 409, title: "Такий запис уже існує. Оновіть сторінку.").ExecuteAsync(ctx); }
    catch (Exception)
    {
        app.Logger.LogError("Request failed. Trace identifier: {TraceId}", ctx.TraceIdentifier);
        await Results.Problem(statusCode: 500, title: "Не вдалося виконати запит. Спробуйте ще раз.",
            extensions: new Dictionary<string, object?> { ["traceId"] = ctx.TraceIdentifier }).ExecuteAsync(ctx);
    }
});
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();
app.Use(async (ctx, next) =>
{
    if (ctx.Request.Path.StartsWithSegments("/api") && !HttpMethods.IsGet(ctx.Request.Method)
        && !HttpMethods.IsHead(ctx.Request.Method) && !HttpMethods.IsOptions(ctx.Request.Method))
        await ctx.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(ctx);
    await next();
});
app.MapControllers();
app.MapGet("/api/health/ready", async (AppDbContext db) => await db.Database.CanConnectAsync() ? Results.Ok(new { status = "ready" }) : Results.StatusCode(503));
app.MapFallbackToFile("index.html");
app.Run();

public partial class Program;

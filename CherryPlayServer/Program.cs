using System.Threading.RateLimiting;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Linq;
using CherryPlayServer.Hubs;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Infrastructure;
using CherryPlayServer.Infrastructure.Repositories;
using CherryPlayServer.Infrastructure.Persistence;
using CherryPlayServer.Infrastructure.Persistence.Repositories;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Infrastructure.Data;
using CherryPlayServer.Infrastructure.OAuth;
using CherryPlayServer.Core.Middleware;
using CherryPlayServer.Core.Authorization;
using CherryPlayServer.Core;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddSignalR();
builder.Services.AddHttpClient();

var corsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
if (corsOrigins.Length == 0 && builder.Environment.IsDevelopment())
    corsOrigins = new[] { "http://localhost:3000", "http://localhost:5173", "http://localhost:5174" };
else if (corsOrigins.Length == 0 && !builder.Environment.IsDevelopment())
    Console.WriteLine("CORS: Cors:AllowedOrigins is empty in non-Development. Configure Cors:AllowedOrigins for production.");

builder.Services.AddCors(options =>
{
    options.AddPolicy("ConfiguredOrigins", policy =>
    {
        policy.WithOrigins(corsOrigins)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

var useInMemoryStorage = builder.Configuration.GetValue<bool>("UseInMemoryStorage");
if (useInMemoryStorage)
{
    builder.Services.AddSingleton<IPartyRepository, InMemoryPartyRepository>();
    builder.Services.AddSingleton<IStreamingRepository, InMemoryStreamingRepository>();
    builder.Services.AddSingleton<IOrganizerRepository, InMemoryOrganizerRepository>();
    builder.Services.AddSingleton<IOrganizerSessionRepository, InMemoryOrganizerSessionRepository>();
    builder.Services.AddSingleton<IOAuthAccountRepository, InMemoryOAuthAccountRepository>();
    builder.Services.AddSingleton<IEmailAccountRepository, InMemoryEmailAccountRepository>();
    builder.Services.AddSingleton<IThemeRepository, InMemoryThemeRepository>();
    builder.Services.AddSingleton<IThemePackageRepository, InMemoryThemePackageRepository>();
    builder.Services.AddSingleton<IOrganizerEntitlementRepository, InMemoryOrganizerEntitlementRepository>();
    builder.Services.AddSingleton<IAdminAuditLogRepository, InMemoryAdminAuditLogRepository>();
}
else
{
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
        ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is not set.");
    builder.Services.AddDbContext<AppDbContext>(options =>
    {
        options.UseNpgsql(connectionString);
        options.UseSnakeCaseNamingConvention();
    });
    builder.Services.AddScoped<IPartyRepository, EfPartyRepository>();
    builder.Services.AddScoped<IStreamingRepository, EfStreamingRepository>();
    builder.Services.AddScoped<IOrganizerRepository, EfOrganizerRepository>();
    builder.Services.AddScoped<IOrganizerSessionRepository, EfOrganizerSessionRepository>();
    builder.Services.AddScoped<IOAuthAccountRepository, EfOAuthAccountRepository>();
    builder.Services.AddScoped<IEmailAccountRepository, EfEmailAccountRepository>();
    builder.Services.AddScoped<IThemeRepository, EfThemeRepository>();
    builder.Services.AddScoped<IThemePackageRepository, EfThemePackageRepository>();
    builder.Services.AddScoped<IOrganizerEntitlementRepository, EfOrganizerEntitlementRepository>();
    builder.Services.AddScoped<IAdminAuditLogRepository, EfAdminAuditLogRepository>();
}

builder.Services.AddSingleton<IShortCodeGenerator, ShortCodeGenerator>();
builder.Services.AddSingleton<IPartyIdValidator, PartyIdValidator>();
builder.Services.AddSingleton<IPlaylistTrackFinder, PlaylistTrackFinder>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IPartyService, PartyService>();
builder.Services.AddScoped<IPublicPartyQueryService, PublicPartyQueryService>();
builder.Services.AddScoped<IStreamingService, StreamingService>();
builder.Services.AddScoped<IOrganizerService, OrganizerService>();
builder.Services.AddScoped<IPartyPlaylistNotifier, PartyHubPlaylistNotifier>();
builder.Services.AddScoped<IPartyAccessService, PartyAccessService>();
builder.Services.AddScoped<IThemeAccessService, ThemeAccessService>();
builder.Services.AddSingleton<IOrganizerConnectionTracker, OrganizerConnectionTracker>();
builder.Services.Configure<CherryPlayServer.Core.Options.PartyDisplayStatusOptions>(
    builder.Configuration.GetSection(CherryPlayServer.Core.Options.PartyDisplayStatusOptions.SectionName));
builder.Services.AddSingleton<IPartyDisplayStatusService, PartyDisplayStatusService>();

builder.Services.AddMemoryCache();
builder.Services.AddSingleton<IJwtService, JwtService>();
builder.Services.AddSingleton<IPasswordHasher, PasswordHasher>();
builder.Services.AddSingleton<IOAuthStateService, OAuthStateService>();

builder.Services.AddTransient<VkOAuthClient>();
builder.Services.AddTransient<MailRuOAuthClient>();
builder.Services.AddTransient<TelegramOAuthClient>();

builder.Services.AddTransient<IOAuthProviderClient>(sp => sp.GetRequiredService<VkOAuthClient>());
builder.Services.AddTransient<IOAuthProviderClient>(sp => sp.GetRequiredService<MailRuOAuthClient>());
builder.Services.AddTransient<IOAuthProviderClient>(sp => sp.GetRequiredService<TelegramOAuthClient>());

builder.Services.AddSingleton<IOAuthService, OAuthService>();
builder.Services.AddScoped<IAuthService, AuthService>();

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("OrganizerOnly", policy =>
        policy.Requirements.Add(new OrganizerRequirement()));
    options.AddPolicy("AdminOnly", policy =>
        policy.Requirements.Add(new AdminRequirement()));
});

builder.Services.AddSingleton<IAuthorizationHandler, OrganizerAuthorizationHandler>();
builder.Services.AddSingleton<IAuthorizationHandler, AdminAuthorizationHandler>();
builder.Services.AddSingleton<IAuthorizationMiddlewareResultHandler, OrganizerAuthorizationResultHandler>();

builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("auth", opt =>
    {
        opt.PermitLimit = AuthConstants.AuthRateLimitPermits;
        opt.Window = AuthConstants.RateLimitWindow;
        opt.QueueLimit = 0;
    });

    options.AddFixedWindowLimiter("public", opt =>
    {
        opt.PermitLimit = AuthConstants.PublicApiRateLimitPermits;
        opt.Window = AuthConstants.RateLimitWindow;
        opt.QueueLimit = 0;
    });

    options.AddFixedWindowLimiter("admin-strict", opt =>
    {
        opt.PermitLimit = AuthConstants.AdminApiRateLimitPermits;
        opt.Window = AuthConstants.RateLimitWindow;
        opt.QueueLimit = 0;
    });

    options.AddFixedWindowLimiter("signalr", opt =>
    {
        opt.PermitLimit = AuthConstants.SignalRRateLimitPermits;
        opt.Window = AuthConstants.RateLimitWindow;
        opt.QueueLimit = 0;
    });

    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        await context.HttpContext.Response.WriteAsync("Too many requests. Try again later.", cancellationToken);
    };
});

builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

builder.Services.AddScoped<IDataSeeder, DataSeeder>();
builder.Services.AddHostedService<DataSeederHostedService>();

var app = builder.Build();

// Apply EF migrations at startup only when explicitly enabled.
var autoMigrateOnStartup = builder.Configuration.GetValue<bool>("Database:AutoMigrateOnStartup");
if (!builder.Configuration.GetValue<bool>("UseInMemoryStorage") && autoMigrateOnStartup)
{
    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Database.Migrate();
    }
}

// Validate OAuth credentials in production
if (!app.Environment.IsDevelopment())
{
    var logger = app.Services.GetRequiredService<ILogger<Program>>();
    var configuration = app.Services.GetRequiredService<IConfiguration>();

    var vkClientId = configuration["OAUTH_VK_CLIENT_ID"];
    var vkClientSecret = configuration["OAUTH_VK_CLIENT_SECRET"];
    var mailruClientId = configuration["OAUTH_MAILRU_CLIENT_ID"];
    var mailruClientSecret = configuration["OAUTH_MAILRU_CLIENT_SECRET"];

    var missingCredentials = new List<string>();

    if (string.IsNullOrWhiteSpace(vkClientId) || vkClientId == "test_client_id")
        missingCredentials.Add("OAUTH_VK_CLIENT_ID");
    if (string.IsNullOrWhiteSpace(vkClientSecret) || vkClientSecret == "test_client_secret")
        missingCredentials.Add("OAUTH_VK_CLIENT_SECRET");
    if (string.IsNullOrWhiteSpace(mailruClientId) || mailruClientId == "test_client_id")
        missingCredentials.Add("OAUTH_MAILRU_CLIENT_ID");
    if (string.IsNullOrWhiteSpace(mailruClientSecret) || mailruClientSecret == "test_client_secret")
        missingCredentials.Add("OAUTH_MAILRU_CLIENT_SECRET");

    if (missingCredentials.Any())
    {
        logger.LogWarning("Missing or default OAuth credentials in production: {Missing}", string.Join(", ", missingCredentials));
        logger.LogWarning("OAuth authentication may not work correctly. Please configure OAuth credentials.");
    }
    else
    {
        logger.LogInformation("OAuth credentials validated successfully");
    }
}

var enableSwagger = app.Environment.IsDevelopment() ||
                    app.Configuration.GetValue<bool>("EnableSwagger", false);
if (enableSwagger)
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

var allowedOrigins = new HashSet<string>(corsOrigins, StringComparer.OrdinalIgnoreCase);
app.Use(async (context, next) =>
{
    try
    {
        await next(context);
    }
    catch (Exception)
    {
        if (!context.Response.HasStarted)
        {
            var origin = context.Request.Headers.Origin.FirstOrDefault();
            if (!string.IsNullOrEmpty(origin) && allowedOrigins.Contains(origin))
            {
                context.Response.Headers.Append("Access-Control-Allow-Origin", origin);
                context.Response.Headers.Append("Access-Control-Allow-Credentials", "true");
            }
        }
        throw;
    }
});

app.UseRouting();
app.UseCors("ConfiguredOrigins");
app.UseRateLimiter();
app.UseExceptionHandler();

app.Use(async (context, next) =>
{
    context.Response.Headers.Append("Cache-Control", "no-cache, no-store, must-revalidate");
    context.Response.Headers.Append("Pragma", "no-cache");
    context.Response.Headers.Append("Expires", "0");

    await next();
});

app.UseMiddleware<JwtAuthenticationMiddleware>();

app.UseAuthorization();

app.MapControllers();
app.MapHub<PartyHub>("/partyHub").RequireRateLimiting("signalr");

app.Run();

public partial class Program { }


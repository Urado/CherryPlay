using System.Text.Json;
using System.Text.Json.Serialization;
using CherryPlayServer.Hubs;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Infrastructure.Repositories;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Infrastructure.Data;

var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddSignalR();

// Configure CORS from appsettings
var corsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
{
    options.AddPolicy("ConfiguredOrigins", policy =>
    {
        if (corsOrigins.Length > 0)
        {
            policy.WithOrigins(corsOrigins)
                  .AllowAnyMethod()
                  .AllowAnyHeader()
                  .AllowCredentials();
        }
        else
        {
            policy.AllowAnyOrigin()
                  .AllowAnyMethod()
                  .AllowAnyHeader();
        }
    });
});

// Register repositories
builder.Services.AddSingleton<IPartyRepository, InMemoryPartyRepository>();
builder.Services.AddSingleton<IStreamingRepository, InMemoryStreamingRepository>();

// Register services
builder.Services.AddSingleton<IShortCodeGenerator, ShortCodeGenerator>();
builder.Services.AddSingleton<IPartyIdValidator, PartyIdValidator>();
builder.Services.AddSingleton<IPlaylistTrackFinder, PlaylistTrackFinder>();
builder.Services.AddScoped<IPartyService, PartyService>();
builder.Services.AddScoped<IPublicPartyQueryService, PublicPartyQueryService>();
builder.Services.AddScoped<IStreamingService, StreamingService>();

// Register data seeder
builder.Services.AddSingleton<IDataSeeder, DataSeeder>();
builder.Services.AddHostedService<DataSeederHostedService>();

var app = builder.Build();

// Configure pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("ConfiguredOrigins");
app.UseRouting();

// Disable caching for all API requests
app.Use(async (context, next) =>
{
    // Set headers to disable caching
    context.Response.Headers.Append("Cache-Control", "no-cache, no-store, must-revalidate");
    context.Response.Headers.Append("Pragma", "no-cache");
    context.Response.Headers.Append("Expires", "0");
    
    await next();
});

app.UseAuthorization();

app.MapControllers();
app.MapHub<PartyHub>("/partyHub");

app.Run();


using CherryPlayServer.Hubs;
using CherryPlayServer.Data;

var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddSignalR();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.WithOrigins("http://localhost:3000", "http://localhost:5173")
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials(); // Необходимо для SignalR
    });
});

// Add InMemory store as singleton
builder.Services.AddSingleton<InMemoryPartyStore>();

var app = builder.Build();

// Initialize sample data
var partyStore = app.Services.GetRequiredService<InMemoryPartyStore>();
partyStore.InitializeWithSampleData();

// Configure pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowAll");
app.UseRouting();

// Отключаем кеширование для всех API запросов
app.Use(async (context, next) =>
{
    // Устанавливаем заголовки для отключения кеширования
    context.Response.Headers.Append("Cache-Control", "no-cache, no-store, must-revalidate");
    context.Response.Headers.Append("Pragma", "no-cache");
    context.Response.Headers.Append("Expires", "0");
    
    await next();
});

app.UseAuthorization();

app.MapControllers();
app.MapHub<PartyHub>("/partyHub");

app.Run();


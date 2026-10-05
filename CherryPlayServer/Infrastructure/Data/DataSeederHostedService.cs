using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace CherryPlayServer.Infrastructure.Data;

public class DataSeederHostedService : IHostedService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<DataSeederHostedService> _logger;

    public DataSeederHostedService(
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration,
        ILogger<DataSeederHostedService> logger)
    {
        _scopeFactory = scopeFactory;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        if (_configuration.GetValue<bool>("UseInMemoryStorage"))
        {
            _logger.LogInformation("Running in-memory demo data seeder");
            var dataSeeder = scope.ServiceProvider.GetRequiredService<IDataSeeder>();
            await dataSeeder.SeedAsync(cancellationToken);
            _logger.LogInformation("In-memory demo data seeding completed");
            return;
        }

        _logger.LogInformation("Ensuring persistent theme catalog data");
        var themeCatalogSeeder = scope.ServiceProvider.GetRequiredService<IThemeCatalogSeeder>();
        await themeCatalogSeeder.SeedAsync(cancellationToken);
        _logger.LogInformation("Persistent theme catalog data is ready");
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }
}

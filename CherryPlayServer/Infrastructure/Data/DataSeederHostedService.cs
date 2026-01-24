using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace CherryPlayServer.Infrastructure.Data;

public class DataSeederHostedService : IHostedService
{
    private readonly IDataSeeder _dataSeeder;
    private readonly ILogger<DataSeederHostedService> _logger;

    public DataSeederHostedService(IDataSeeder dataSeeder, ILogger<DataSeederHostedService> logger)
    {
        _dataSeeder = dataSeeder;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Running data seeder");
        await _dataSeeder.SeedAsync(cancellationToken);
        _logger.LogInformation("Data seeder completed");
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }
}

using CherryPlayServer.Infrastructure.Health;
using CherryPlayServer.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace CherryPlayServer.Tests;

public class DatabaseHealthCheckTests
{
    [Test]
    public async Task CheckHealthAsync_ReturnsHealthy_WhenInMemoryDatabaseIsAvailable()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        await using var dbContext = new AppDbContext(options);
        var check = new DatabaseHealthCheck(dbContext);

        var result = await check.CheckHealthAsync(new HealthCheckContext());

        Assert.That(result.Status, Is.EqualTo(HealthStatus.Healthy));
        Assert.That(result.Data, Is.Empty);
    }

    [Test]
    public async Task CheckHealthAsync_ReturnsUnhealthy_WhenTimedOut()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        await using var dbContext = new AppDbContext(options);
        var check = new DatabaseHealthCheck(dbContext);
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();

        var result = await check.CheckHealthAsync(new HealthCheckContext(), cancellation.Token);

        Assert.That(result.Status, Is.EqualTo(HealthStatus.Unhealthy));
        Assert.That(result.Data, Is.Empty);
    }
}

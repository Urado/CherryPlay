using CherryPlayServer.Core;
using CherryPlayServer.Core.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace CherryPlayServer.Infrastructure.Data;

public sealed class PasswordResetTokenRetentionCleanupHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<PasswordResetTokenRetentionCleanupHostedService> _logger;

    public PasswordResetTokenRetentionCleanupHostedService(
        IServiceScopeFactory scopeFactory,
        ILogger<PasswordResetTokenRetentionCleanupHostedService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var repository = scope.ServiceProvider.GetRequiredService<IPasswordResetTokenRepository>();
                var deleted = await repository.DeleteStaleAsync(
                    DateTime.UtcNow,
                    AuthConstants.PasswordResetTokenRecordRetention,
                    stoppingToken);
                if (deleted > 0)
                {
                    _logger.LogInformation(
                        "Password reset token retention cleanup deleted {DeletedCount} stale rows",
                        deleted);
                }
                else
                {
                    _logger.LogDebug(
                        "Password reset token retention cleanup deleted {DeletedCount} stale rows",
                        deleted);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Password reset token retention cleanup failed");
            }

            await Task.Delay(AuthConstants.PasswordResetTokenRetentionCleanupInterval, stoppingToken);
        }
    }
}

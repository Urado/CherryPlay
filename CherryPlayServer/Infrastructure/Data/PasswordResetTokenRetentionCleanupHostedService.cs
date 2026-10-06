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
    private readonly Func<TimeSpan, CancellationToken, Task> _delayAsync;

    public PasswordResetTokenRetentionCleanupHostedService(
        IServiceScopeFactory scopeFactory,
        ILogger<PasswordResetTokenRetentionCleanupHostedService> logger,
        Func<TimeSpan, CancellationToken, Task>? delayAsync = null)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _delayAsync = delayAsync ?? Task.Delay;
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
                _logger.LogError(
                    "Password reset token retention cleanup failed: {FailureType}",
                    ex.GetType().Name);
            }

            await _delayAsync(AuthConstants.PasswordResetTokenRetentionCleanupInterval, stoppingToken);
        }
    }
}

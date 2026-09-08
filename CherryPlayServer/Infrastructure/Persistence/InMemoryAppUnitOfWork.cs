using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Infrastructure.Persistence;

public sealed class InMemoryAppUnitOfWork : IAppUnitOfWork
{
    private readonly object _commitGate = new();

    public InMemoryAppUnitOfWork(
        IOrganizerRepository organizers,
        IEmailAccountRepository emailAccounts,
        IOAuthAccountRepository oauthAccounts,
        IOrganizerSessionRepository sessions)
    {
        Organizers = organizers ?? throw new ArgumentNullException(nameof(organizers));
        EmailAccounts = emailAccounts ?? throw new ArgumentNullException(nameof(emailAccounts));
        OAuthAccounts = oauthAccounts ?? throw new ArgumentNullException(nameof(oauthAccounts));
        Sessions = sessions ?? throw new ArgumentNullException(nameof(sessions));
    }

    public IOrganizerRepository Organizers { get; }
    public IEmailAccountRepository EmailAccounts { get; }
    public IOAuthAccountRepository OAuthAccounts { get; }
    public IOrganizerSessionRepository Sessions { get; }

    public Task BeginTransactionAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        InMemoryUnitOfWorkScope.Begin();
        return Task.CompletedTask;
    }

    public Task CommitAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        InMemoryUnitOfWorkScope.Commit(_commitGate);
        return Task.CompletedTask;
    }

    public Task RollbackAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        InMemoryUnitOfWorkScope.Rollback();
        return Task.CompletedTask;
    }
}

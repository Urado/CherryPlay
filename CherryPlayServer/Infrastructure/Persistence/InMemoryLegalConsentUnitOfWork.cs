using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Infrastructure.Persistence;

public sealed class InMemoryLegalConsentUnitOfWork : ILegalConsentUnitOfWork
{
    private readonly object _commitGate = new();

    public InMemoryLegalConsentUnitOfWork(
        IOrganizerRepository organizers,
        IEmailAccountRepository emailAccounts,
        IOAuthAccountRepository oauthAccounts,
        IConsentEventRepository consentEvents,
        ILegalDocumentVersionRepository documentVersions)
    {
        Organizers = organizers ?? throw new ArgumentNullException(nameof(organizers));
        EmailAccounts = emailAccounts ?? throw new ArgumentNullException(nameof(emailAccounts));
        OAuthAccounts = oauthAccounts ?? throw new ArgumentNullException(nameof(oauthAccounts));
        ConsentEvents = consentEvents ?? throw new ArgumentNullException(nameof(consentEvents));
        DocumentVersions = documentVersions ?? throw new ArgumentNullException(nameof(documentVersions));
    }

    public IOrganizerRepository Organizers { get; }
    public IEmailAccountRepository EmailAccounts { get; }
    public IOAuthAccountRepository OAuthAccounts { get; }
    public IConsentEventRepository ConsentEvents { get; }
    public ILegalDocumentVersionRepository DocumentVersions { get; }

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

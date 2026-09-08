using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Infrastructure.Persistence;

public sealed class UnsupportedLegalConsentUnitOfWork : ILegalConsentUnitOfWork
{
    private const string MutationUnsupportedMessage =
        "Legal consent mutations require UseInMemoryStorage=true until an EF-backed unit of work and consent repositories exist.";

    public IOrganizerRepository Organizers => throw new InvalidOperationException(MutationUnsupportedMessage);
    public IEmailAccountRepository EmailAccounts => throw new InvalidOperationException(MutationUnsupportedMessage);
    public IOAuthAccountRepository OAuthAccounts => throw new InvalidOperationException(MutationUnsupportedMessage);
    public IConsentEventRepository ConsentEvents => throw new InvalidOperationException(MutationUnsupportedMessage);
    public ILegalDocumentVersionRepository DocumentVersions => throw new InvalidOperationException(MutationUnsupportedMessage);

    public Task BeginTransactionAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        throw new InvalidOperationException(MutationUnsupportedMessage);
    }

    public Task CommitAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        throw new InvalidOperationException(MutationUnsupportedMessage);
    }

    public Task RollbackAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return Task.CompletedTask;
    }
}

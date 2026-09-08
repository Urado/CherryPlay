using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Infrastructure.Persistence;

public sealed class InMemoryLegalConsentUnitOfWork : ILegalConsentUnitOfWork
{
    private static readonly AsyncLocal<InMemoryLegalConsentTransaction?> Ambient = new();
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

    internal static InMemoryLegalConsentTransaction? Current => Ambient.Value;

    public Task BeginTransactionAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        EnsureNoNestedTransaction();
        Ambient.Value = new InMemoryLegalConsentTransaction();
        return Task.CompletedTask;
    }

    public Task CommitAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var transaction = Ambient.Value
            ?? throw new InvalidOperationException("No active legal consent transaction to commit.");

        try
        {
            transaction.Commit(_commitGate);
        }
        finally
        {
            transaction.Exit();
            Ambient.Value = null;
        }

        return Task.CompletedTask;
    }

    public Task RollbackAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var transaction = Ambient.Value;
        if (transaction is null)
        {
            return Task.CompletedTask;
        }

        transaction.Exit();
        Ambient.Value = null;
        return Task.CompletedTask;
    }

    private static void EnsureNoNestedTransaction()
    {
        if (Ambient.Value is not null)
        {
            throw new InvalidOperationException("Nested legal consent transactions are not supported.");
        }
    }
}

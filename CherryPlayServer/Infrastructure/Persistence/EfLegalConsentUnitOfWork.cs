using CherryPlayServer.Core.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace CherryPlayServer.Infrastructure.Persistence;

public sealed class EfLegalConsentUnitOfWork : ILegalConsentUnitOfWork
{
    private readonly AppDbContext _context;
    private IDbContextTransaction? _transaction;

    public EfLegalConsentUnitOfWork(
        AppDbContext context,
        IOrganizerRepository organizers,
        IEmailAccountRepository emailAccounts,
        IOAuthAccountRepository oauthAccounts,
        IConsentEventRepository consentEvents,
        ILegalDocumentVersionRepository documentVersions)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
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

    public async Task BeginTransactionAsync(CancellationToken cancellationToken = default)
    {
        if (_transaction is not null)
        {
            throw new InvalidOperationException("A transaction is already active.");
        }

        _transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
    }

    public async Task CommitAsync(CancellationToken cancellationToken = default)
    {
        if (_transaction is null)
        {
            throw new InvalidOperationException("No active transaction to commit.");
        }

        try
        {
            await _context.SaveChangesAsync(cancellationToken);
            await _transaction.CommitAsync(cancellationToken);
        }
        finally
        {
            await _transaction.DisposeAsync();
            _transaction = null;
        }
    }

    public async Task RollbackAsync(CancellationToken cancellationToken = default)
    {
        if (_transaction is null)
        {
            return;
        }

        try
        {
            await _transaction.RollbackAsync(cancellationToken);
        }
        finally
        {
            await _transaction.DisposeAsync();
            _transaction = null;
        }
    }
}

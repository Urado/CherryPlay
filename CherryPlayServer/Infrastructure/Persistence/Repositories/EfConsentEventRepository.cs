using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Infrastructure.Persistence.Entities;
using CherryPlayServer.Infrastructure.Persistence.Mappings;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace CherryPlayServer.Infrastructure.Persistence.Repositories;

public class EfConsentEventRepository : IConsentEventRepository
{
    private const string InsertSavepointName = "consent_insert";

    private readonly AppDbContext _context;

    public EfConsentEventRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<ConsentEvent>> ListBySubjectAsync(
        Guid subjectId,
        CancellationToken cancellationToken = default)
    {
        var rows = await _context.ConsentEvents
            .AsNoTracking()
            .Where(e => e.SubjectId == subjectId)
            .OrderBy(e => e.EventAt)
            .ToListAsync(cancellationToken);
        return rows.Select(r => r.ToDomain()).ToList();
    }

    public async Task<ConsentEvent?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var ef = await _context.ConsentEvents
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == id, cancellationToken);
        return ef?.ToDomain();
    }

    public async Task<bool> TryAddAsync(
        ConsentEvent consentEvent,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(consentEvent);

        if (await _context.ConsentEvents.AnyAsync(e => e.Id == consentEvent.Id, cancellationToken))
        {
            return false;
        }

        var ef = consentEvent.ToEf();
        _context.ConsentEvents.Add(ef);
        return await TryPersistNewRowsAsync([ef], cancellationToken);
    }

    public async Task<bool> TryAddBatchAsync(
        IReadOnlyList<ConsentEvent> events,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(events);
        if (events.Count == 0)
        {
            return true;
        }

        var ids = events.Select(e => e.Id).ToList();
        if (ids.Count != ids.Distinct().Count())
        {
            return false;
        }

        if (await _context.ConsentEvents.AnyAsync(e => ids.Contains(e.Id), cancellationToken))
        {
            return false;
        }

        var efRows = events.Select(e => e.ToEf()).ToList();
        _context.ConsentEvents.AddRange(efRows);
        return await TryPersistNewRowsAsync(efRows, cancellationToken);
    }

    public Task<bool> TryRemoveAsync(Guid id, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        throw new NotSupportedException(
            "Consent events are append-only; hard-delete is not supported on the EF path.");
    }

    private async Task<bool> TryPersistNewRowsAsync(
        IReadOnlyList<ConsentEventEf> efRows,
        CancellationToken cancellationToken)
    {
        var transaction = _context.Database.CurrentTransaction;
        if (transaction is not null)
        {
            await transaction.CreateSavepointAsync(InsertSavepointName, cancellationToken);
            try
            {
                await _context.SaveChangesAsync(cancellationToken);
                await transaction.ReleaseSavepointAsync(InsertSavepointName, cancellationToken);
                return true;
            }
            catch (DbUpdateException ex) when (IsUniqueViolation(ex))
            {
                await transaction.RollbackToSavepointAsync(InsertSavepointName, cancellationToken);
                DetachAll(efRows);
                return false;
            }
            catch
            {
                await transaction.RollbackToSavepointAsync(InsertSavepointName, cancellationToken);
                DetachAll(efRows);
                throw;
            }
        }

        try
        {
            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            DetachAll(efRows);
            return false;
        }
        catch (DbUpdateException)
        {
            DetachAll(efRows);
            throw;
        }
    }

    private void DetachAll(IReadOnlyList<ConsentEventEf> efRows)
    {
        foreach (var ef in efRows)
        {
            _context.Entry(ef).State = EntityState.Detached;
        }
    }

    private static bool IsUniqueViolation(DbUpdateException exception)
    {
        for (Exception? current = exception; current is not null; current = current.InnerException)
        {
            if (current is PostgresException postgres &&
                postgres.SqlState == PostgresErrorCodes.UniqueViolation)
            {
                return true;
            }
        }

        return false;
    }
}

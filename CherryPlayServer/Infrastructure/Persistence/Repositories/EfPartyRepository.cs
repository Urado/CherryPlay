using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using CherryPlayServer.Core;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;
using CherryPlayServer.Infrastructure.Persistence.Mappings;

namespace CherryPlayServer.Infrastructure.Persistence.Repositories;

public class EfPartyRepository : IPartyRepository, IPartyLifecycleRepository, IPartyMetadataRepository
{
    private readonly AppDbContext _context;
    private readonly ILogger<EfPartyRepository> _logger;

    public EfPartyRepository(AppDbContext context, ILogger<EfPartyRepository> logger)
    {
        _context = context;
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<Party?> GetByIdAsync(Guid id)
    {
        var ef = await _context.Parties
            .AsNoTracking()
            .Include(e => e.Playlist)
            .FirstOrDefaultAsync(e => e.Id == id && !e.IsDeleted);
        return ef?.ToDomain(_logger);
    }

    public async Task<Party?> GetByShortCodeAsync(string shortCode)
    {
        var ef = await _context.Parties
            .AsNoTracking()
            .Include(e => e.Playlist)
            .FirstOrDefaultAsync(e => e.ShortCode == shortCode && !e.IsDeleted);
        return ef?.ToDomain(_logger);
    }

    public async Task<List<Party>> GetAllAsync()
    {
        var list = await _context.Parties
            .AsNoTracking()
            .Include(e => e.Playlist)
            .Where(e => !e.IsDeleted)
            .OrderBy(e => e.CreatedAt)
            .ToListAsync();
        return list.Select(e => e.ToDomain(_logger)).ToList();
    }

    public async Task<IReadOnlyList<PublicPartyCatalogRecord>> GetAllWithOrganizerNamesAsync()
    {
        var list = await _context.Parties
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(party => party.Playlist)
            .Where(party => !party.IsDeleted)
            .OrderBy(party => party.CreatedAt)
            .Select(party => new
            {
                Party = party,
                OrganizerName = party.Organizer.Name
            })
            .ToListAsync();

        return list
            .Select(item => new PublicPartyCatalogRecord(
                item.Party.ToDomain(_logger),
                item.OrganizerName))
            .ToArray();
    }

    public async Task<List<Party>> GetByOrganizerIdAsync(Guid organizerId)
    {
        var list = await _context.Parties
            .AsNoTracking()
            .Include(e => e.Playlist)
            .Where(e => e.OrganizerId == organizerId && !e.IsDeleted)
            .OrderBy(e => e.CreatedAt)
            .ToListAsync();
        return list.Select(e => e.ToDomain(_logger)).ToList();
    }

    public async Task<Party> AddAsync(Party party)
    {
        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            await AddWithinTransactionAsync(party);
            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
        return party;
    }

    public async Task<bool> AddIfFuturePartyLimitNotReachedAsync(Party party, DateTime nowUtc, int limit)
    {
        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            await _context.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT pg_advisory_xact_lock(hashtextextended({party.OrganizerId.ToString()}, 0))");
            var futureCount = await CountFuturePartiesAsync(party.OrganizerId, nowUtc, excludePartyId: null);
            if (futureCount >= limit)
            {
                await transaction.CommitAsync();
                return false;
            }

            await AddWithinTransactionAsync(party);
            await transaction.CommitAsync();
            return true;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    private async Task AddWithinTransactionAsync(Party party)
    {
        var partyEf = party.ToEf();
        _context.Parties.Add(partyEf);
        await _context.SaveChangesAsync();
        var playlistEf = party.Playlist.ToEf(party.Id);
        _context.PartyPlaylists.Add(playlistEf);
        await _context.SaveChangesAsync();
    }

    public async Task<bool> UpdateIfFuturePartyLimitNotReachedAsync(
        Party party,
        DateTime? previousEventDateTime,
        DateTime nowUtc,
        int limit)
    {
        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            _ = previousEventDateTime;
            await _context.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT pg_advisory_xact_lock(hashtextextended({party.OrganizerId.ToString()}, 0))");
            var storedEventDateTime = await _context.Parties.AsNoTracking()
                .Where(item => item.Id == party.Id && !item.IsDeleted)
                .Select(item => new { item.EventDateTime })
                .FirstOrDefaultAsync();
            if (storedEventDateTime != null &&
                PartyFutureLimit.EntersFutureSet(storedEventDateTime.EventDateTime, party.EventDateTime, nowUtc))
            {
                var futureCount = await CountFuturePartiesAsync(party.OrganizerId, nowUtc, party.Id);
                if (futureCount >= limit)
                {
                    await transaction.CommitAsync();
                    return false;
                }
            }

            await UpdateAsync(party);
            await transaction.CommitAsync();
            return true;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task UpdateAsync(Party party)
    {
        var ef = await _context.Parties
            .Include(e => e.Playlist)
            .FirstOrDefaultAsync(e => e.Id == party.Id && !e.IsDeleted);
        if (ef == null)
            return;

        party.ApplyTo(ef);
        if (ef.Playlist != null)
        {
            ef.Playlist.Items = party.Playlist.Items;
            ef.Playlist.TotalDuration = party.Playlist.TotalDuration;
            ef.Playlist.TotalTracks = party.Playlist.TotalTracks;
            ef.Playlist.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            _context.PartyPlaylists.Add(party.Playlist.ToEf(party.Id));
        }

        await _context.SaveChangesAsync();
    }

    public async Task UpdateMetadataAsync(Party party, bool? isListedInCatalog, CancellationToken cancellationToken = default)
    {
        var ef = await _context.Parties.FirstOrDefaultAsync(item => item.Id == party.Id && !item.IsDeleted, cancellationToken);
        if (ef is null)
        {
            throw new InvalidOperationException($"Party {party.Id} not found.");
        }

        party.ApplyTo(ef);
        if (isListedInCatalog.HasValue)
        {
            ef.IsListedInCatalog = isListedInCatalog.Value;
        }
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<bool> UpdateLifecycleStateAsync(
        Guid partyId,
        PartyLifecycleState state,
        CancellationToken cancellationToken = default)
    {
        var party = await _context.Parties
            .FirstOrDefaultAsync(item => item.Id == partyId && !item.IsDeleted, cancellationToken);
        if (party is null)
        {
            return false;
        }

        party.PartyLifecycleState = state;
        party.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    private Task<int> CountFuturePartiesAsync(Guid organizerId, DateTime nowUtc, Guid? excludePartyId)
    {
        var query = _context.Parties.AsNoTracking().Where(item =>
            item.OrganizerId == organizerId &&
            !item.IsDeleted &&
            (item.EventDateTime == null || item.EventDateTime > nowUtc));
        if (excludePartyId.HasValue)
        {
            var excludedId = excludePartyId.Value;
            query = query.Where(item => item.Id != excludedId);
        }

        return query.CountAsync();
    }

    public async Task DeleteAsync(Guid id)
    {
        var ef = await _context.Parties
            .FirstOrDefaultAsync(e => e.Id == id && !e.IsDeleted);
        if (ef == null)
            return;
        ef.IsDeleted = true;
        await _context.SaveChangesAsync();
    }

    public async Task<Party?> GetFirstAsync()
    {
        var ef = await _context.Parties
            .AsNoTracking()
            .Include(e => e.Playlist)
            .Where(e => !e.IsDeleted)
            .FirstOrDefaultAsync();
        return ef?.ToDomain(_logger);
    }
}

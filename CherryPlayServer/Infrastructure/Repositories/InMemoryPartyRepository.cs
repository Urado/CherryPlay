using System.Collections.Concurrent;
using System;
using CherryPlayServer.Core;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;

namespace CherryPlayServer.Infrastructure.Repositories;

public class InMemoryPartyRepository : IPartyRepository
{
    private readonly IOrganizerRepository? _organizerRepository;
    private readonly ConcurrentDictionary<Guid, Party> _parties = new();
    private readonly ConcurrentDictionary<Guid, object> _organizerLocks = new();
    private readonly ConcurrentDictionary<string, Guid> _shortCodeIndex =
        new(StringComparer.OrdinalIgnoreCase);

    public InMemoryPartyRepository(IOrganizerRepository? organizerRepository = null)
    {
        _organizerRepository = organizerRepository;
    }

    public Task<Party?> GetByIdAsync(Guid id)
    {
        _parties.TryGetValue(id, out var party);
        return Task.FromResult(party);
    }

    public Task<Party?> GetByShortCodeAsync(string shortCode)
    {
        if (_shortCodeIndex.TryGetValue(shortCode, out var partyId) &&
            _parties.TryGetValue(partyId, out var party))
        {
            return Task.FromResult<Party?>(party);
        }

        return Task.FromResult<Party?>(null);
    }

    public Task<List<Party>> GetAllAsync()
    {
        return Task.FromResult(_parties.Values.ToList());
    }

    public async Task<IReadOnlyList<PublicPartyCatalogRecord>> GetAllWithOrganizerNamesAsync()
    {
        var parties = _parties.Values.ToArray();
        var organizerNames = new Dictionary<Guid, string?>();
        if (_organizerRepository is not null)
        {
            foreach (var organizerId in parties.Select(party => party.OrganizerId).Distinct())
            {
                var organizer = await _organizerRepository.GetByIdAsync(organizerId);
                organizerNames[organizerId] = organizer?.Name;
            }
        }

        return parties
            .Select(party => new PublicPartyCatalogRecord(
                party,
                organizerNames.GetValueOrDefault(party.OrganizerId)))
            .ToArray();
    }

    public Task<List<Party>> GetByOrganizerIdAsync(Guid organizerId)
    {
        var list = _parties.Values.Where(p => p.OrganizerId == organizerId).ToList();
        return Task.FromResult(list);
    }

    public Task<Party> AddAsync(Party party)
    {
        _parties.TryAdd(party.Id, party);
        _shortCodeIndex[party.ShortCode] = party.Id;
        return Task.FromResult(party);
    }

    public Task<bool> AddIfFuturePartyLimitNotReachedAsync(Party party, DateTime nowUtc, int limit)
    {
        var organizerLock = _organizerLocks.GetOrAdd(party.OrganizerId, _ => new object());
        lock (organizerLock)
        {
            var futureCount = _parties.Values.Count(item =>
                item.OrganizerId == party.OrganizerId &&
                PartyFutureLimit.CountsAsFuture(item.EventDateTime, nowUtc));
            if (futureCount >= limit)
            {
                return Task.FromResult(false);
            }

            _parties.TryAdd(party.Id, party);
            _shortCodeIndex[party.ShortCode] = party.Id;
            return Task.FromResult(true);
        }
    }

    public Task UpdateAsync(Party party)
    {
        ApplyUpdate(party);
        return Task.CompletedTask;
    }

    public Task<bool> UpdateIfFuturePartyLimitNotReachedAsync(
        Party party,
        DateTime? previousEventDateTime,
        DateTime nowUtc,
        int limit)
    {
        _ = previousEventDateTime;
        var organizerLock = _organizerLocks.GetOrAdd(party.OrganizerId, _ => new object());
        lock (organizerLock)
        {
            if (_parties.TryGetValue(party.Id, out var stored) &&
                PartyFutureLimit.EntersFutureSet(stored.EventDateTime, party.EventDateTime, nowUtc))
            {
                var futureCount = _parties.Values.Count(item =>
                    item.OrganizerId == party.OrganizerId &&
                    item.Id != party.Id &&
                    PartyFutureLimit.CountsAsFuture(item.EventDateTime, nowUtc));
                if (futureCount >= limit)
                {
                    return Task.FromResult(false);
                }
            }

            ApplyUpdate(party);
            return Task.FromResult(true);
        }
    }

    private void ApplyUpdate(Party party)
    {
        if (_parties.TryGetValue(party.Id, out var existingParty) &&
            !string.Equals(existingParty.ShortCode, party.ShortCode, StringComparison.OrdinalIgnoreCase))
        {
            _shortCodeIndex.TryRemove(existingParty.ShortCode, out _);
        }

        _parties.AddOrUpdate(party.Id, party, (key, oldValue) => party);
        _shortCodeIndex[party.ShortCode] = party.Id;
    }

    public Task DeleteAsync(Guid id)
    {
        if (_parties.TryRemove(id, out var party))
        {
            _shortCodeIndex.TryRemove(party.ShortCode, out _);
        }
        return Task.CompletedTask;
    }

    public Task<Party?> GetFirstAsync()
    {
        var party = _parties.Values.FirstOrDefault();
        return Task.FromResult(party);
    }
}

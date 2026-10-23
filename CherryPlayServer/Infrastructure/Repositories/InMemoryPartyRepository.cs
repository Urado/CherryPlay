using System.Collections.Concurrent;
using System;
using CherryPlayServer.Core;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;

namespace CherryPlayServer.Infrastructure.Repositories;

public class InMemoryPartyRepository : IPartyRepository, IPartyLifecycleRepository, IPartyMetadataRepository
{
    private readonly IOrganizerRepository? _organizerRepository;
    private readonly ConcurrentDictionary<Guid, Party> _parties = new();
    private readonly ConcurrentDictionary<Guid, Party> _deletedParties = new();
    private readonly ConcurrentDictionary<Guid, object> _partyLocks = new();
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

    public Task<IReadOnlyList<Party>> GetAllForAdminAsync()
    {
        IReadOnlyList<Party> parties = _parties.Values.Concat(_deletedParties.Values)
            .OrderBy(party => party.CreatedAt)
            .ThenBy(party => party.Id)
            .ToArray();
        return Task.FromResult(parties);
    }

    public Task<Party?> GetByIdIncludingDeletedForAdminAsync(Guid id)
    {
        if (_parties.TryGetValue(id, out var party))
        {
            return Task.FromResult<Party?>(party);
        }

        _deletedParties.TryGetValue(id, out var deletedParty);
        return Task.FromResult<Party?>(deletedParty);
    }

    public Task<bool> SetLifecycleStateForAdminAsync(Guid id, PartyLifecycleState state)
    {
        var partyLock = _partyLocks.GetOrAdd(id, static _ => new object());
        lock (partyLock)
        {
            if (!_parties.TryGetValue(id, out var party))
            {
                return Task.FromResult(false);
            }

            party.SetLifecycleForAdministrator(state);
            return Task.FromResult(true);
        }
    }

    public Task<bool> SetCatalogVisibilityForAdminAsync(Guid id, bool isListedInCatalog)
    {
        var partyLock = _partyLocks.GetOrAdd(id, static _ => new object());
        lock (partyLock)
        {
            if (!_parties.TryGetValue(id, out var party))
            {
                return Task.FromResult(false);
            }

            party.SetCatalogVisibility(isListedInCatalog);
            return Task.FromResult(true);
        }
    }

    public Task<bool> UpdateLifecycleStateAsync(Guid partyId, PartyLifecycleState state, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return SetLifecycleStateForAdminAsync(partyId, state);
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
        _deletedParties.TryRemove(party.Id, out _);
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

            _deletedParties.TryRemove(party.Id, out _);
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

    public Task UpdateMetadataAsync(Party party, bool? isListedInCatalog, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (!_parties.TryGetValue(party.Id, out var existing))
        {
            return Task.CompletedTask;
        }

        lock (_partyLocks.GetOrAdd(party.Id, _ => new object()))
        {
            if (!_parties.TryGetValue(party.Id, out existing))
            {
                return Task.CompletedTask;
            }

            existing.Name = party.Name;
            existing.Title = party.Title;
            existing.Subtitle = party.Subtitle;
            existing.Description = party.Description;
            existing.Place = party.Place;
            existing.City = party.City;
            existing.EventDateTime = party.EventDateTime;
            existing.EventEndDateTime = party.EventEndDateTime;
            existing.Schedule = party.Schedule;
            existing.TimeZone = party.TimeZone;
            existing.PartyThemeId = party.PartyThemeId;
            existing.CustomizationSettings = party.CustomizationSettings;
            existing.ShortDescription = party.ShortDescription;
            existing.ExternalLinkUrl = party.ExternalLinkUrl;
            existing.ExternalLinkText = party.ExternalLinkText;
            existing.DanceTags = party.DanceTags;
            if (isListedInCatalog.HasValue)
            {
                existing.SetCatalogVisibility(isListedInCatalog.Value);
            }
        }

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
        var partyLock = _partyLocks.GetOrAdd(party.Id, static _ => new object());
        lock (partyLock)
        {
            if (!_parties.TryGetValue(party.Id, out var existingParty))
            {
                _parties.TryAdd(party.Id, party);
                _shortCodeIndex[party.ShortCode] = party.Id;
                return;
            }

            if (!string.Equals(existingParty.ShortCode, party.ShortCode, StringComparison.OrdinalIgnoreCase))
            {
                _shortCodeIndex.TryRemove(existingParty.ShortCode, out _);
            }

            existingParty.Name = party.Name;
            existingParty.Title = party.Title;
            existingParty.Subtitle = party.Subtitle;
            existingParty.ShortCode = party.ShortCode;
            existingParty.PartyThemeId = party.PartyThemeId;
            existingParty.CustomizationSettings = party.CustomizationSettings;
            existingParty.Playlist = party.Playlist;
            existingParty.CreatedAt = party.CreatedAt;
            existingParty.Description = party.Description;
            existingParty.Place = party.Place;
            existingParty.City = party.City;
            existingParty.EventDateTime = party.EventDateTime;
            existingParty.EventEndDateTime = party.EventEndDateTime;
            existingParty.Schedule = party.Schedule;
            existingParty.TimeZone = party.TimeZone;
            existingParty.ShortDescription = party.ShortDescription;
            existingParty.ExternalLinkUrl = party.ExternalLinkUrl;
            existingParty.ExternalLinkText = party.ExternalLinkText;
            existingParty.DanceTags = party.DanceTags;
            _shortCodeIndex[party.ShortCode] = party.Id;
        }
    }

    public Task DeleteAsync(Guid id)
    {
        if (_parties.TryRemove(id, out var party))
        {
            _shortCodeIndex.TryRemove(party.ShortCode, out _);
            party.MarkAsDeleted();
            _deletedParties[id] = party;
        }
        return Task.CompletedTask;
    }

    public Task<Party?> GetFirstAsync()
    {
        var party = _parties.Values.FirstOrDefault();
        return Task.FromResult(party);
    }
}

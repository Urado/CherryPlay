using CherryPlayServer.Core.Exceptions;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Core.Services;

public class PartyAccessService : IPartyAccessService
{
    private readonly IPartyRepository _partyRepository;
    private readonly ILogger<PartyAccessService> _logger;

    public PartyAccessService(IPartyRepository partyRepository, ILogger<PartyAccessService> logger)
    {
        _partyRepository = partyRepository ?? throw new ArgumentNullException(nameof(partyRepository));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task EnsurePartyOwnershipAsync(Guid partyId, Guid organizerId)
    {
        var party = await _partyRepository.GetByIdAsync(partyId);
        if (party == null)
        {
            throw new PartyNotFoundException(partyId);
        }

        if (party.OrganizerId != organizerId)
        {
            _logger.LogWarning(
                "Access denied: party {PartyId} does not belong to organizer {OrganizerId}",
                partyId,
                organizerId);
            throw new ForbiddenException("You do not have permission to access this party");
        }
    }
}

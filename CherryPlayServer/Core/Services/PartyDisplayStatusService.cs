using CherryPlayServer.Core.Entities;

using CherryPlayServer.Core.Enums;

using CherryPlayServer.Core.Interfaces;

using CherryPlayServer.Core.Options;

using Microsoft.Extensions.Options;



namespace CherryPlayServer.Core.Services;



public class PartyDisplayStatusService : IPartyDisplayStatusService

{

    private readonly IOrganizerConnectionTracker _organizerConnectionTracker;

    private readonly PartyDisplayStatusOptions _options;



    public PartyDisplayStatusService(

        IOrganizerConnectionTracker organizerConnectionTracker,

        IOptions<PartyDisplayStatusOptions> options)

    {

        _organizerConnectionTracker = organizerConnectionTracker

            ?? throw new ArgumentNullException(nameof(organizerConnectionTracker));

        _options = options?.Value ?? throw new ArgumentNullException(nameof(options));

    }



    public PartyDisplayStatus Compute(

        PartyLifecycleState lifecycle,

        PlaybackState? sessionState,

        Guid partyId,

        DateTime? utcNow = null)

    {

        var now = utcNow ?? DateTime.UtcNow;

        var hasActiveSession = HasEffectiveActiveSession(sessionState);

        var organizerConnected = _organizerConnectionTracker.IsOrganizerConnected(partyId);



        if (lifecycle == PartyLifecycleState.Completed)

        {

            return PartyDisplayStatus.PartyEnded;

        }



        if (lifecycle == PartyLifecycleState.Draft)

        {

            return PartyDisplayStatus.Draft;

        }



        if (hasActiveSession && IsOrganizerOfflinePastGrace(partyId, organizerConnected, now))

        {

            return PartyDisplayStatus.OrganizerOffline;

        }



        if (hasActiveSession

            && !organizerConnected

            && IsOrganizerDisconnectedWithinGrace(partyId, organizerConnected, now))

        {

            return PartyDisplayStatus.Live;

        }



        if (hasActiveSession

            && !organizerConnected

            && !TryGetOrganizerDisconnectedAt(partyId, out _))

        {

            return PartyDisplayStatus.OrganizerOffline;

        }



        if (hasActiveSession

            && organizerConnected

            && !IsPlaybackStale(sessionState, now))

        {

            return PartyDisplayStatus.Live;

        }



        if (hasActiveSession && organizerConnected && IsPlaybackStale(sessionState, now))

        {

            return PartyDisplayStatus.OrganizerOffline;

        }



        if (organizerConnected && !hasActiveSession)

        {

            return PartyDisplayStatus.StartingSoon;

        }



        return PartyDisplayStatus.Scheduled;

    }



    private static bool HasEffectiveActiveSession(PlaybackState? sessionState) =>

        sessionState is { IsActive: true, Mode: PlaybackMode.Session };



    private TimeSpan OrganizerOfflineGrace =>

        TimeSpan.FromSeconds(Math.Max(0, _options.OrganizerOfflineGraceSeconds));



    private bool IsOrganizerOfflinePastGrace(Guid partyId, bool organizerConnected, DateTime now)

    {

        if (organizerConnected)

        {

            return false;

        }



        if (!TryGetOrganizerDisconnectedAt(partyId, out var disconnectedAt))

        {

            return false;

        }



        return now - disconnectedAt >= OrganizerOfflineGrace;

    }



    private bool IsOrganizerDisconnectedWithinGrace(Guid partyId, bool organizerConnected, DateTime now)

    {

        if (organizerConnected)

        {

            return false;

        }



        if (!TryGetOrganizerDisconnectedAt(partyId, out var disconnectedAt))

        {

            return false;

        }



        return now - disconnectedAt < OrganizerOfflineGrace;

    }



    private bool TryGetOrganizerDisconnectedAt(Guid partyId, out DateTime disconnectedAt) =>

        _organizerConnectionTracker.TryGetOrganizerDisconnectedAt(partyId, out disconnectedAt);



    private bool IsPlaybackStale(PlaybackState? sessionState, DateTime now)

    {

        if (!HasEffectiveActiveSession(sessionState))

        {

            return false;

        }



        var threshold = TimeSpan.FromSeconds(Math.Max(1, _options.PlaybackStaleThresholdSeconds));

        return now - sessionState!.LastUpdatedAt > threshold;

    }

}



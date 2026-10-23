using CherryPlayServer.Infrastructure;

namespace CherryPlayServer.Tests;

[TestFixture]
public sealed class OrganizerConnectionTrackerMultiConnectionTests
{
    [TestCase(false)]
    [TestCase(true)]
    public void RemovingConnections_OnlyMarksPartyOfflineAfterLastConnection(bool reverseOrder)
    {
        var tracker = new OrganizerConnectionTracker();
        var partyId = Guid.NewGuid();
        tracker.RegisterOrganizer("connection-1", partyId);
        tracker.RegisterOrganizer("connection-2", partyId);
        var first = reverseOrder ? "connection-2" : "connection-1";
        var last = reverseOrder ? "connection-1" : "connection-2";

        Assert.That(tracker.TryRemoveOrganizer(first), Is.Null);
        Assert.That(tracker.IsOrganizerConnected(partyId), Is.True);
        Assert.That(tracker.TryGetOrganizerDisconnectedAt(partyId, out _), Is.False);

        Assert.That(tracker.TryRemoveOrganizer(last), Is.EqualTo(partyId));
        Assert.That(tracker.IsOrganizerConnected(partyId), Is.False);
        Assert.That(tracker.TryGetOrganizerDisconnectedAt(partyId, out _), Is.True);
    }

    [Test]
    public void RegisteringAnExistingConnectionForAnotherParty_CleansUpOldPartyMembership()
    {
        var tracker = new OrganizerConnectionTracker();
        var oldPartyId = Guid.NewGuid();
        var newPartyId = Guid.NewGuid();
        tracker.RegisterOrganizer("connection-1", oldPartyId);
        tracker.RegisterOrganizer("connection-2", oldPartyId);

        tracker.RegisterOrganizer("connection-1", newPartyId);

        Assert.That(tracker.GetPartyId("connection-1"), Is.EqualTo(newPartyId));
        Assert.That(tracker.IsOrganizerConnected(oldPartyId), Is.True);
        Assert.That(tracker.TryGetOrganizerDisconnectedAt(oldPartyId, out _), Is.False);
        Assert.That(tracker.IsOrganizerConnected(newPartyId), Is.True);
        Assert.That(tracker.TryRemoveOrganizer("connection-2"), Is.EqualTo(oldPartyId));
        Assert.That(tracker.IsOrganizerConnected(oldPartyId), Is.False);
    }

    [Test]
    public void RemovingConnectionWithStalePartySnapshot_DoesNotRemoveItsNewPartyMembership()
    {
        var tracker = new OrganizerConnectionTracker();
        var oldPartyId = Guid.NewGuid();
        var newPartyId = Guid.NewGuid();
        tracker.RegisterOrganizer("connection-1", oldPartyId);
        tracker.RegisterOrganizer("connection-1", newPartyId);

        Assert.That(tracker.TryRemoveOrganizer("connection-1", oldPartyId), Is.Null);
        Assert.That(tracker.GetPartyId("connection-1"), Is.EqualTo(newPartyId));
        Assert.That(tracker.IsOrganizerConnected(newPartyId), Is.True);
    }
}

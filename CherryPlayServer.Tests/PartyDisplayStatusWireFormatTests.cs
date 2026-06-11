using System.Text.Json;
using System.Text.Json.Serialization;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Models;

namespace CherryPlayServer.Tests;

[TestFixture]
public class PartyDisplayStatusWireFormatTests
{
    private static readonly JsonSerializerOptions ApiJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Converters = { new JsonStringEnumConverter() },
    };

    [TestCase(PartyDisplayStatus.Draft, "draft")]
    [TestCase(PartyDisplayStatus.Scheduled, "scheduled")]
    [TestCase(PartyDisplayStatus.StartingSoon, "starting_soon")]
    [TestCase(PartyDisplayStatus.Live, "live")]
    [TestCase(PartyDisplayStatus.OrganizerOffline, "organizer_offline")]
    [TestCase(PartyDisplayStatus.PartyEnded, "party_ended")]
    public void PartyDisplayStatus_SerializesToSnakeCaseString(PartyDisplayStatus status, string expected)
    {
        var json = JsonSerializer.Serialize(status, ApiJsonOptions);
        Assert.That(json, Is.EqualTo($"\"{expected}\""));
    }

    [Test]
    public void PartyStateDto_SerializesPartyDisplayStatus_WithCamelCasePropertyAndSnakeCaseValue()
    {
        var dto = new PartyStateDto(
            partyId: "party-1",
            isSessionActive: true,
            partyDisplayStatus: PartyDisplayStatus.Live,
            playbackState: null,
            playlist: new PartyPlaylistDto(),
            serverTrackIds: []);

        var json = JsonSerializer.Serialize(dto, ApiJsonOptions);

        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        Assert.That(root.TryGetProperty("partyDisplayStatus", out var statusProp), Is.True);
        Assert.That(statusProp.GetString(), Is.EqualTo("live"));
    }
}

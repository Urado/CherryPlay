namespace CherryPlayServer.Tests.IntegrationDb;

public sealed class AdminPartyApiScenario(
    IntegrationDbWebApplicationFactory factory,
    HttpClient client,
    string connectionString,
    string token,
    Guid organizerId,
    Guid visibleDraftPartyId,
    Guid hiddenCompletedPartyId,
    Guid deletedPartyId,
    Guid deletedOrganizerPartyId) : IAsyncDisposable
{
    public IntegrationDbWebApplicationFactory Factory { get; } = factory;
    public HttpClient Client { get; } = client;
    public string ConnectionString { get; } = connectionString;
    public string Token { get; } = token;
    public Guid OrganizerId { get; } = organizerId;
    public Guid VisibleDraftPartyId { get; } = visibleDraftPartyId;
    public Guid HiddenCompletedPartyId { get; } = hiddenCompletedPartyId;
    public Guid DeletedPartyId { get; } = deletedPartyId;
    public Guid DeletedOrganizerPartyId { get; } = deletedOrganizerPartyId;

    public ValueTask DisposeAsync()
    {
        Client.Dispose();
        return Factory.DisposeAsync();
    }
}

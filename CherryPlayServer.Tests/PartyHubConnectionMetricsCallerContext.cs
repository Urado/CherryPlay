using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Connections.Features;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.SignalR;

namespace CherryPlayServer.Tests;

public sealed class PartyHubConnectionMetricsCallerContext : HubCallerContext, IHttpContextFeature
{
    public PartyHubConnectionMetricsCallerContext(HttpContext httpContext, string connectionId)
    {
        HttpContext = httpContext;
        ConnectionId = connectionId;
        Features.Set<IHttpContextFeature>(this);
    }

    public HttpContext? HttpContext { get; set; }
    public override IFeatureCollection Features { get; } = new FeatureCollection();
    public override string ConnectionId { get; }
    public override string? UserIdentifier => null;
    public override ClaimsPrincipal? User => null;
    public override IDictionary<object, object?> Items { get; } = new Dictionary<object, object?>();
    public override CancellationToken ConnectionAborted => CancellationToken.None;
    public override void Abort()
    {
    }
}

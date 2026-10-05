using System.Collections.Concurrent;
using System.Text.Json;
using System.Threading.Channels;
using Microsoft.AspNetCore.SignalR.Client;

namespace CherryPlayServer.Tests;

public sealed class ContainerSignalRSessionEventProbe : IDisposable
{
    private readonly Channel<(string Method, object?[] Arguments)> _events = Channel.CreateUnbounded<(string, object?[])>();
    private readonly Channel<string> _errors = Channel.CreateUnbounded<string>();
    private readonly List<IDisposable> _subscriptions = [];

    public ContainerSignalRSessionEventProbe(HubConnection connection)
    {
        _subscriptions.Add(connection.On<string>("Error", message =>
        {
            Errors.Enqueue(message);
            _errors.Writer.TryWrite(message);
        }));
        foreach (var method in new[] { "OnSessionStarted", "OnSessionEnded", "OnStateChanged", "OnPlaylistChanged", "PlaybackStateReset" })
        {
            _subscriptions.Add(connection.On<string>(method, partyId => Capture(method, partyId)));
        }
        _subscriptions.Add(connection.On<string, string, double>("OnPlaybackPositionUpdated", (partyId, trackId, position) => Capture("OnPlaybackPositionUpdated", partyId, trackId, position)));
        _subscriptions.Add(connection.On<string, JsonElement>("OnFullStateUpdated", (partyId, state) => Capture("OnFullStateUpdated", partyId, state.Clone())));
        _subscriptions.Add(connection.On<string, JsonElement>("OnPartyDisplayStatusChanged", (partyId, status) => Capture("OnPartyDisplayStatusChanged", partyId, status.Clone())));
        _subscriptions.Add(connection.On<string, bool>("OnConnectionStatusChanged", (partyId, connected) => Capture("OnConnectionStatusChanged", partyId, connected)));
    }

    public ConcurrentQueue<(string Method, object?[] Arguments)> SuccessEvents { get; } = new();
    public ConcurrentQueue<string> Errors { get; } = new();

    public async Task<object?[]> WaitForEventAsync(string method)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        while (true)
        {
            var message = await _events.Reader.ReadAsync(timeout.Token);
            if (message.Method == method)
            {
                return message.Arguments;
            }
        }
    }

    public Task<string> WaitForErrorAsync() => _errors.Reader.ReadAsync().AsTask().WaitAsync(TimeSpan.FromSeconds(10));

    public void BeginObservation()
    {
        SuccessEvents.Clear();
        Errors.Clear();
        while (_events.Reader.TryRead(out _)) { }
        while (_errors.Reader.TryRead(out _)) { }
    }

    public void Dispose()
    {
        foreach (var subscription in _subscriptions)
        {
            subscription.Dispose();
        }
    }

    private void Capture(string method, params object?[] arguments)
    {
        var message = (method, arguments);
        SuccessEvents.Enqueue(message);
        _events.Writer.TryWrite(message);
    }
}

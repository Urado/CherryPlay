namespace CherryPlayServer.Tests;

internal sealed class DesktopReleaseHttpClientFactoryStub(HttpMessageHandler handler) : IHttpClientFactory
{
    public HttpClient CreateClient(string name) => new(handler, disposeHandler: false);
}

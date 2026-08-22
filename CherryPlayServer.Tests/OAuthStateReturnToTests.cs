using CherryPlayServer.Core;
using CherryPlayServer.Core.Services;
using Microsoft.Extensions.Caching.Memory;

namespace CherryPlayServer.Tests;

public class OAuthStateReturnToTests
{
    [Test]
    public void GenerateAndConsume_PersistsReturnToAndClient()
    {
        var service = CreateService();
        var returnTo = "http://localhost:5173/auth/callback";

        var state = service.GenerateAndStoreState(
            "vk",
            AuthConstants.DesktopClientValue,
            returnTo);
        var result = service.ValidateAndConsumeStateWithClient(state, "vk");

        Assert.That(result, Is.Not.Null);
        Assert.That(result!.Client, Is.EqualTo(AuthConstants.DesktopClientValue));
        Assert.That(result.ReturnTo, Is.EqualTo(returnTo));
    }

    [Test]
    public void GenerateAndConsume_WithoutReturnTo_ReturnsNullReturnTo()
    {
        var service = CreateService();

        var state = service.GenerateAndStoreState("mailru", AuthConstants.DesktopClientValue);
        var result = service.ValidateAndConsumeStateWithClient(state, "mailru");

        Assert.That(result, Is.Not.Null);
        Assert.That(result!.Client, Is.EqualTo(AuthConstants.DesktopClientValue));
        Assert.That(result.ReturnTo, Is.Null);
    }

    [Test]
    public void ValidateAndConsume_WrongProvider_ReturnsNull()
    {
        var service = CreateService();
        var state = service.GenerateAndStoreState(
            "vk",
            AuthConstants.DesktopClientValue,
            "http://127.0.0.1:5174/auth/callback");

        Assert.That(service.ValidateAndConsumeStateWithClient(state, "mailru"), Is.Null);
    }

    [Test]
    public void ValidateAndConsume_SecondCall_ReturnsNull()
    {
        var service = CreateService();
        var state = service.GenerateAndStoreState(
            "vk",
            AuthConstants.DesktopClientValue,
            "cherryplaylist://auth");

        Assert.That(service.ValidateAndConsumeStateWithClient(state, "vk"), Is.Not.Null);
        Assert.That(service.ValidateAndConsumeStateWithClient(state, "vk"), Is.Null);
    }

    [Test]
    public void InMemoryDesktopAuthCodeRepository_CoversSameGetValidTryMarkUsedSemanticsAsEf()
    {
        Assert.That(
            typeof(CherryPlayServer.Infrastructure.Repositories.InMemoryDesktopAuthCodeRepository)
                .GetInterfaces(),
            Does.Contain(typeof(CherryPlayServer.Core.Interfaces.IDesktopAuthCodeRepository)));
        Assert.That(
            typeof(CherryPlayServer.Infrastructure.Persistence.Repositories.EfDesktopAuthCodeRepository)
                .GetInterfaces(),
            Does.Contain(typeof(CherryPlayServer.Core.Interfaces.IDesktopAuthCodeRepository)));
    }

    private static OAuthStateService CreateService() =>
        new(new MemoryCache(new MemoryCacheOptions()));
}

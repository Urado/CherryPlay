using CherryPlayServer.Core;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Authorization;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Extensions;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Infrastructure.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

namespace CherryPlayServer.Tests;

[TestFixture]
[Category("AdminPartyUnit")]
public class AdminCredentialAndSessionAuthorizationTests
{
    [Test]
    public void ExtractTokenFromRequest_UsesBearerTokenBeforeCookie()
    {
        var context = new DefaultHttpContext();
        context.Request.Headers.Authorization = "Bearer header-token";
        context.Request.Headers.Cookie = $"{AuthConstants.AuthCookieName}=cookie-token";

        Assert.That(context.ExtractTokenFromRequest(), Is.EqualTo("header-token"));
    }

    [Test]
    public void ExtractTokenFromRequest_UsesConfiguredAuthenticationCookie()
    {
        var context = new DefaultHttpContext();
        context.Request.Headers.Cookie = $"{AuthConstants.AuthCookieName}=cookie-token";

        Assert.That(context.ExtractTokenFromRequest(), Is.EqualTo("cookie-token"));
    }

    [Test]
    public void ExtractTokenFromRequest_DoesNotTreatOtherAuthorizationSchemesAsBearer()
    {
        var context = new DefaultHttpContext();
        context.Request.Headers.Authorization = "Basic abc";

        Assert.That(context.ExtractTokenFromRequest(), Is.Null);
    }

    [Test]
    public void ExtractTokenFromRequest_DoesNotFallBackToCookieWhenBearerIsInvalid()
    {
        var context = new DefaultHttpContext();
        context.Request.Headers.Authorization = "Bearer ";
        context.Request.Headers.Cookie = $"{AuthConstants.AuthCookieName}=cookie-token";

        Assert.That(context.ExtractTokenFromRequest(), Is.Null);
    }

    [Test]
    public async Task OrganizerAuthorizationHandler_RequiresPersistedMatchingSession()
    {
        var organizerId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var services = new ServiceCollection();
        services.AddSingleton<IOrganizerSessionRepository, InMemoryOrganizerSessionRepository>();
        await using var provider = services.BuildServiceProvider();
        var repository = provider.GetRequiredService<IOrganizerSessionRepository>();
        await repository.AddAsync(new OrganizerSession { Id = sessionId, OrganizerId = organizerId });
        var scopeFactory = provider.GetRequiredService<IServiceScopeFactory>();
        var handler = new OrganizerAuthorizationHandler(scopeFactory);
        var context = new DefaultHttpContext();
        context.Items["OrganizerId"] = organizerId;
        context.Items["SessionId"] = sessionId;
        var authorization = new AuthorizationHandlerContext([new OrganizerRequirement()], new System.Security.Claims.ClaimsPrincipal(), context);

        await handler.HandleAsync(authorization);

        Assert.That(authorization.HasSucceeded, Is.True);
    }

    [TestCase(false, true, false)]
    [TestCase(true, false, false)]
    [TestCase(true, true, true)]
    public async Task OrganizerAuthorizationHandler_RejectsMissingOrForeignSession(bool addSession, bool matchingOrganizer, bool expectedSuccess)
    {
        var organizerId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var services = new ServiceCollection();
        services.AddSingleton<IOrganizerSessionRepository, InMemoryOrganizerSessionRepository>();
        await using var provider = services.BuildServiceProvider();
        var repository = provider.GetRequiredService<IOrganizerSessionRepository>();
        if (addSession)
        {
            await repository.AddAsync(new OrganizerSession { Id = sessionId, OrganizerId = matchingOrganizer ? organizerId : Guid.NewGuid() });
        }

        var context = new DefaultHttpContext();
        context.Items["OrganizerId"] = organizerId;
        context.Items["SessionId"] = sessionId;
        var authorization = new AuthorizationHandlerContext([new OrganizerRequirement()], new System.Security.Claims.ClaimsPrincipal(), context);
        await new OrganizerAuthorizationHandler(provider.GetRequiredService<IServiceScopeFactory>()).HandleAsync(authorization);

        Assert.That(authorization.HasSucceeded, Is.EqualTo(expectedSuccess));
    }

    [TestCase(OrganizerRole.Admin, true)]
    [TestCase(OrganizerRole.Organizer, false)]
    public async Task AdminAuthorizationHandler_UsesPersistedRole(OrganizerRole role, bool expectedSuccess)
    {
        var organizerId = Guid.NewGuid();
        var services = new ServiceCollection();
        services.AddSingleton<IOrganizerRepository, InMemoryOrganizerRepository>();
        await using var provider = services.BuildServiceProvider();
        await provider.GetRequiredService<IOrganizerRepository>().AddAsync(new Organizer { Id = organizerId, Role = role });
        var context = new DefaultHttpContext();
        context.Items["OrganizerId"] = organizerId;
        var authorization = new AuthorizationHandlerContext([new AdminRequirement()], new System.Security.Claims.ClaimsPrincipal(), context);

        await new AdminAuthorizationHandler(provider.GetRequiredService<IServiceScopeFactory>()).HandleAsync(authorization);

        Assert.That(authorization.HasSucceeded, Is.EqualTo(expectedSuccess));
    }

    [Test]
    public async Task AdminAuthorizationHandler_RejectsMissingAndSoftDeletedOrganizer()
    {
        var organizerId = Guid.NewGuid();
        var services = new ServiceCollection();
        services.AddSingleton<IOrganizerRepository, InMemoryOrganizerRepository>();
        await using var provider = services.BuildServiceProvider();
        var repository = provider.GetRequiredService<IOrganizerRepository>();
        await repository.AddAsync(new Organizer { Id = organizerId, Role = OrganizerRole.Admin });
        await repository.DeleteAsync(organizerId);
        var context = new DefaultHttpContext();
        context.Items["OrganizerId"] = organizerId;
        var authorization = new AuthorizationHandlerContext([new AdminRequirement()], new System.Security.Claims.ClaimsPrincipal(), context);

        await new AdminAuthorizationHandler(provider.GetRequiredService<IServiceScopeFactory>()).HandleAsync(authorization);

        Assert.That(authorization.HasSucceeded, Is.False);
    }

}

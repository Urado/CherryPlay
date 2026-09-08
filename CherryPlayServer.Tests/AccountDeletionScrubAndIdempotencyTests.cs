using CherryPlayServer.Core;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Infrastructure.Persistence;
using CherryPlayServer.Infrastructure.Repositories;
using CherryPlayServer.Models;
using Microsoft.Extensions.Logging.Abstractions;

namespace CherryPlayServer.Tests;

public class AccountDeletionScrubAndIdempotencyTests
{
    [Test]
    public async Task DeleteAccountAsync_ScrubsPiiFields_IncludingDefaultsAndRole()
    {
        var organizers = new InMemoryOrganizerRepository();
        var emails = new InMemoryEmailAccountRepository();
        var oauth = new InMemoryOAuthAccountRepository();
        var sessions = new InMemoryOrganizerSessionRepository();

        var organizer = new Organizer
        {
            Id = Guid.NewGuid(),
            Name = "PII Holder",
            LogoUrl = "https://cdn.example/logo.png",
            Links = new Dictionary<string, string> { ["tg"] = "@pii" },
            TimeZone = "Europe/Moscow",
            DefaultPartyThemeId = PartyThemeId.Cyberpunk,
            DefaultCustomizationSettings = new Dictionary<string, object> { ["accent"] = "#ff0000" },
            Role = OrganizerRole.Admin,
            CreatedAt = DateTime.UtcNow,
        };
        await organizers.AddAsync(organizer);

        var service = CreateService(organizers, emails, oauth, sessions, new NoopConsentEvents());
        await service.DeleteAccountAsync(organizer.Id);

        var scrubbed = await organizers.GetByIdAsync(organizer.Id, includeDeleted: true);
        Assert.That(scrubbed, Is.Not.Null);
        Assert.That(scrubbed!.Name, Is.EqualTo(OrganizerDisplayNames.Deleted));
        Assert.That(scrubbed.LogoUrl, Is.Null);
        Assert.That(scrubbed.Links, Is.Null);
        Assert.That(scrubbed.TimeZone, Is.Null);
        Assert.That(scrubbed.DefaultPartyThemeId, Is.Null);
        Assert.That(scrubbed.DefaultCustomizationSettings, Is.Null);
        Assert.That(scrubbed.Role, Is.EqualTo(OrganizerRole.Organizer));
        Assert.That(await organizers.GetByIdAsync(organizer.Id), Is.Null);
    }

    [Test]
    public async Task DeleteAccountAsync_RemovesOAuthAccounts()
    {
        var organizers = new InMemoryOrganizerRepository();
        var emails = new InMemoryEmailAccountRepository();
        var oauth = new InMemoryOAuthAccountRepository();
        var sessions = new InMemoryOrganizerSessionRepository();

        var organizer = new Organizer
        {
            Id = Guid.NewGuid(),
            Name = "OAuth User",
            CreatedAt = DateTime.UtcNow,
        };
        await organizers.AddAsync(organizer);
        await oauth.AddAsync(new OAuthAccount
        {
            Id = Guid.NewGuid(),
            OrganizerId = organizer.Id,
            Provider = OAuthProvider.Telegram,
            ProviderUserId = "tg-123",
            ProviderUserName = "pii_user",
            CreatedAt = DateTime.UtcNow,
        });
        await oauth.AddAsync(new OAuthAccount
        {
            Id = Guid.NewGuid(),
            OrganizerId = organizer.Id,
            Provider = OAuthProvider.Vk,
            ProviderUserId = "vk-456",
            CreatedAt = DateTime.UtcNow,
        });

        var service = CreateService(organizers, emails, oauth, sessions, new NoopConsentEvents());
        await service.DeleteAccountAsync(organizer.Id);

        Assert.That(await oauth.GetByOrganizerIdAsync(organizer.Id), Is.Empty);
        Assert.That(
            await oauth.GetByProviderUserIdAsync(OAuthProvider.Telegram, "tg-123"),
            Is.Null);
        Assert.That(await organizers.GetByIdAsync(organizer.Id), Is.Null);
    }

    [Test]
    public async Task DeleteAccountAsync_WhenAlreadyDeleted_IsIdempotentNoOp()
    {
        var organizers = new InMemoryOrganizerRepository();
        var emails = new InMemoryEmailAccountRepository();
        var oauth = new InMemoryOAuthAccountRepository();
        var sessions = new InMemoryOrganizerSessionRepository();

        var organizer = new Organizer
        {
            Id = Guid.NewGuid(),
            Name = "Once",
            CreatedAt = DateTime.UtcNow,
        };
        await organizers.AddAsync(organizer);
        await organizers.DeleteAsync(organizer.Id);

        var service = CreateService(organizers, emails, oauth, sessions, new NoopConsentEvents());
        await service.DeleteAccountAsync(organizer.Id);

        Assert.That(await organizers.GetByIdAsync(organizer.Id), Is.Null);
        Assert.That(
            (await organizers.GetByIdAsync(organizer.Id, includeDeleted: true))!.Name,
            Is.EqualTo("Once"));
    }

    [Test]
    public async Task DeleteAccountAsync_WhenNotFound_IsIdempotentNoOp()
    {
        var organizers = new InMemoryOrganizerRepository();
        var emails = new InMemoryEmailAccountRepository();
        var oauth = new InMemoryOAuthAccountRepository();
        var sessions = new InMemoryOrganizerSessionRepository();
        var missingId = Guid.NewGuid();

        var service = CreateService(organizers, emails, oauth, sessions, new NoopConsentEvents());
        await service.DeleteAccountAsync(missingId);

        Assert.That(await organizers.GetByIdAsync(missingId, includeDeleted: true), Is.Null);
    }

    [Test]
    public async Task DeleteAccountAsync_WhenConsentThrowsGeneric_ContinuesDeletion()
    {
        var organizers = new InMemoryOrganizerRepository();
        var emails = new InMemoryEmailAccountRepository();
        var oauth = new InMemoryOAuthAccountRepository();
        var sessions = new InMemoryOrganizerSessionRepository();
        var hasher = new PasswordHasher();

        var organizer = new Organizer
        {
            Id = Guid.NewGuid(),
            Name = "Consent Fail",
            CreatedAt = DateTime.UtcNow,
        };
        await organizers.AddAsync(organizer);
        await emails.AddAsync(new EmailAccount
        {
            Id = Guid.NewGuid(),
            OrganizerId = organizer.Id,
            Email = "consent-fail@example.com",
            PasswordHash = hasher.HashPassword("password1"),
            CreatedAt = DateTime.UtcNow,
        });

        var service = CreateService(
            organizers,
            emails,
            oauth,
            sessions,
            new ThrowingConsentEvents());

        await service.DeleteAccountAsync(organizer.Id);

        Assert.That(await organizers.GetByIdAsync(organizer.Id), Is.Null);
        Assert.That(
            (await organizers.GetByIdAsync(organizer.Id, includeDeleted: true))!.Name,
            Is.EqualTo(OrganizerDisplayNames.Deleted));
        Assert.That(await emails.GetByEmailAsync("consent-fail@example.com"), Is.Null);
    }

    private static OrganizerService CreateService(
        InMemoryOrganizerRepository organizers,
        InMemoryEmailAccountRepository emails,
        InMemoryOAuthAccountRepository oauth,
        InMemoryOrganizerSessionRepository sessions,
        IConsentEventsService consent) =>
        new(
            organizers,
            new InMemoryAppUnitOfWork(organizers, emails, oauth, sessions),
            consent,
            NullLogger<OrganizerService>.Instance);

    private sealed class NoopConsentEvents : IConsentEventsService
    {
        public Task<IReadOnlyList<ConsentEventDto>> ListAsync(
            Guid organizerId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<ConsentEventDto>>([]);

        public Task<IReadOnlyList<ConsentEventDto>> CreateAsync(
            Guid organizerId,
            CreateConsentEventsRequest request,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<ConsentEventDto>>([]);

        public Task<bool> AreIdempotentReplayAsync(
            Guid subjectId,
            IReadOnlyList<ConsentInputDto> consents,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(false);

        public Task EnsureNoConflictsAsync(
            Guid subjectId,
            IReadOnlyList<ConsentInputDto> consents,
            CancellationToken cancellationToken = default) =>
            Task.CompletedTask;

        public Task<IReadOnlyList<ConsentEventDto>> AppendAsync(
            Guid subjectId,
            IReadOnlyList<ConsentInputDto> consents,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<ConsentEventDto>>([]);
    }

    private sealed class ThrowingConsentEvents : IConsentEventsService
    {
        public Task<IReadOnlyList<ConsentEventDto>> ListAsync(
            Guid organizerId,
            CancellationToken cancellationToken = default) =>
            throw new InvalidDataException("consent store blew up");

        public Task<IReadOnlyList<ConsentEventDto>> CreateAsync(
            Guid organizerId,
            CreateConsentEventsRequest request,
            CancellationToken cancellationToken = default) =>
            throw new InvalidDataException("consent store blew up");

        public Task<bool> AreIdempotentReplayAsync(
            Guid subjectId,
            IReadOnlyList<ConsentInputDto> consents,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(false);

        public Task EnsureNoConflictsAsync(
            Guid subjectId,
            IReadOnlyList<ConsentInputDto> consents,
            CancellationToken cancellationToken = default) =>
            Task.CompletedTask;

        public Task<IReadOnlyList<ConsentEventDto>> AppendAsync(
            Guid subjectId,
            IReadOnlyList<ConsentInputDto> consents,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<ConsentEventDto>>([]);
    }
}

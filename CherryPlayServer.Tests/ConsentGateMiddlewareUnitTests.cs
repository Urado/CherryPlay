using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Middleware;
using CherryPlayServer.Core.Models;
using CherryPlayServer.Models;
using Microsoft.AspNetCore.Http;

namespace CherryPlayServer.Tests;

[TestFixture]
public class ConsentGateMiddlewareUnitTests
{
    [Test]
    public async Task InvokeAsync_AdminPrefix_IsExempt()
    {
        var legalDocs = new ThrowingLegalDocumentsService();
        var nextCalled = false;
        var middleware = new ConsentGateMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        var context = CreateMutatingContext("/api/admin/entitlements");

        await middleware.InvokeAsync(context, legalDocs);

        Assert.That(nextCalled, Is.True);
        Assert.That(legalDocs.GetMissingCalls, Is.EqualTo(0));
    }

    [Test]
    public void InvokeAsync_WhenMissingGrants_ThrowsConsentRequired()
    {
        var missing = new[] { Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa") };
        var legalDocs = new StubLegalDocumentsService(missing);
        var middleware = new ConsentGateMiddleware(_ => Task.CompletedTask);
        var context = CreateMutatingContext("/api/organizer/profile");

        var ex = Assert.ThrowsAsync<CherryPlayServer.Core.Exceptions.LegalConsentException>(
            () => middleware.InvokeAsync(context, legalDocs));

        Assert.That(ex!.Kind, Is.EqualTo(CherryPlayServer.Core.Enums.LegalConsentFailureKind.ConsentRequired));
        Assert.That(ex.Missing, Is.EquivalentTo(missing));
        Assert.That(legalDocs.GetMissingCalls, Is.EqualTo(1));
    }

    [Test]
    public async Task InvokeAsync_GetRequest_DoesNotEnforce()
    {
        var legalDocs = new ThrowingLegalDocumentsService();
        var nextCalled = false;
        var middleware = new ConsentGateMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        var context = new DefaultHttpContext();
        context.Request.Method = HttpMethods.Get;
        context.Request.Path = "/api/organizer/profile";
        context.Items["OrganizerId"] = Guid.Parse("11111111-1111-1111-1111-111111111111");

        await middleware.InvokeAsync(context, legalDocs);

        Assert.That(nextCalled, Is.True);
        Assert.That(legalDocs.GetMissingCalls, Is.EqualTo(0));
    }

    private static DefaultHttpContext CreateMutatingContext(string path)
    {
        var context = new DefaultHttpContext();
        context.Request.Method = HttpMethods.Patch;
        context.Request.Path = path;
        context.Items["OrganizerId"] = Guid.Parse("11111111-1111-1111-1111-111111111111");
        return context;
    }

    private sealed class ThrowingLegalDocumentsService : ILegalDocumentsService
    {
        public int GetMissingCalls { get; private set; }

        public Task<IReadOnlyList<LegalDocumentVersionInfo>> GetRequiredActiveAsync(
            CancellationToken cancellationToken = default) =>
            throw new InvalidOperationException("Should not be called.");

        public Task EnsureActiveConsentAsync(
            Guid legalDocumentVersionId,
            string documentHash,
            CancellationToken cancellationToken = default) =>
            throw new InvalidOperationException("Should not be called.");

        public Task EnsureRequiredActiveGrantsAsync(
            IReadOnlyList<ConsentInputDto> consents,
            CancellationToken cancellationToken = default) =>
            throw new InvalidOperationException("Should not be called.");

        public Task<bool> HasGrantAsync(
            Guid subjectId,
            Guid legalDocumentVersionId,
            CancellationToken cancellationToken = default) =>
            throw new InvalidOperationException("Should not be called.");

        public Task<IReadOnlyList<Guid>> GetMissingRequiredGrantsAsync(
            Guid subjectId,
            CancellationToken cancellationToken = default)
        {
            GetMissingCalls++;
            throw new InvalidOperationException("Should not be called when gate is exempt.");
        }
    }

    private sealed class StubLegalDocumentsService(IReadOnlyList<Guid> missing) : ILegalDocumentsService
    {
        public int GetMissingCalls { get; private set; }

        public Task<IReadOnlyList<LegalDocumentVersionInfo>> GetRequiredActiveAsync(
            CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<LegalDocumentVersionInfo>>([]);

        public Task EnsureActiveConsentAsync(
            Guid legalDocumentVersionId,
            string documentHash,
            CancellationToken cancellationToken = default) =>
            Task.CompletedTask;

        public Task EnsureRequiredActiveGrantsAsync(
            IReadOnlyList<ConsentInputDto> consents,
            CancellationToken cancellationToken = default) =>
            Task.CompletedTask;

        public Task<bool> HasGrantAsync(
            Guid subjectId,
            Guid legalDocumentVersionId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(false);

        public Task<IReadOnlyList<Guid>> GetMissingRequiredGrantsAsync(
            Guid subjectId,
            CancellationToken cancellationToken = default)
        {
            GetMissingCalls++;
            return Task.FromResult(missing);
        }
    }
}

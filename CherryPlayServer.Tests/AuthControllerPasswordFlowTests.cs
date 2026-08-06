using CherryPlayServer.Controllers;
using CherryPlayServer.Core;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;
using CherryPlayServer.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace CherryPlayServer.Tests;

public class AuthControllerPasswordFlowTests
{
    [Test]
    public async Task ForgotPassword_MapsGenericSuccess_To200()
    {
        var auth = new StubAuthService
        {
            ForgotResult = new ForgotPasswordResult(true, false, AuthConstants.ForgotPasswordGenericMessage, null),
        };
        var controller = CreateController(auth);

        var action = await controller.ForgotPassword(new ForgotPasswordRequest("user@example.com"));

        Assert.That(action.Result, Is.TypeOf<OkObjectResult>());
        var ok = (OkObjectResult)action.Result!;
        Assert.That(ok.StatusCode, Is.EqualTo(200).Or.Null);
        Assert.That(ok.Value, Is.TypeOf<ForgotPasswordResponse>());
        Assert.That(((ForgotPasswordResponse)ok.Value!).Message, Is.EqualTo(AuthConstants.ForgotPasswordGenericMessage));
    }

    [Test]
    public async Task ForgotPassword_MapsServiceUnavailable_To503()
    {
        var auth = new StubAuthService
        {
            ForgotResult = new ForgotPasswordResult(
                false,
                true,
                null,
                AuthConstants.EmailServiceUnavailableMessage),
        };
        var controller = CreateController(auth);

        var action = await controller.ForgotPassword(new ForgotPasswordRequest("user@example.com"));

        Assert.That(action.Result, Is.TypeOf<ObjectResult>());
        var result = (ObjectResult)action.Result!;
        Assert.That(result.StatusCode, Is.EqualTo(StatusCodes.Status503ServiceUnavailable));
        Assert.That(result.Value, Is.EqualTo(AuthConstants.EmailServiceUnavailableMessage));
    }

    [Test]
    public async Task ForgotPassword_MapsValidationFailure_To400()
    {
        var auth = new StubAuthService
        {
            ForgotResult = new ForgotPasswordResult(false, false, null, "Некорректный email"),
        };
        var controller = CreateController(auth);

        var action = await controller.ForgotPassword(new ForgotPasswordRequest("bad"));

        Assert.That(action.Result, Is.TypeOf<BadRequestObjectResult>());
    }

    [Test]
    public async Task ResetPassword_MapsSuccess_To204_AndDeletesCookie()
    {
        var auth = new StubAuthService
        {
            ResetResult = new PasswordMutationResult(true, null, null),
        };
        var controller = CreateController(auth);

        var action = await controller.ResetPassword(new ResetPasswordRequest("token", "newpass9"));

        Assert.That(action, Is.TypeOf<NoContentResult>());
        AssertAuthCookieDeleted(controller.Response);
    }

    [Test]
    public async Task ResetPassword_MapsFailure_To400()
    {
        var auth = new StubAuthService
        {
            ResetResult = new PasswordMutationResult(
                false,
                PasswordMutationFailureKind.InvalidToken,
                AuthConstants.PasswordResetInvalidTokenMessage),
        };
        var controller = CreateController(auth);

        var action = await controller.ResetPassword(new ResetPasswordRequest("bad", "newpass9"));

        Assert.That(action, Is.TypeOf<BadRequestObjectResult>());
    }

    [Test]
    public async Task ChangePassword_MapsSuccess_To204_AndDeletesCookie()
    {
        var organizerId = Guid.NewGuid();
        var auth = new StubAuthService
        {
            ChangeResult = new PasswordMutationResult(true, null, null),
        };
        var controller = CreateController(auth, organizerId);

        var action = await controller.ChangePassword(new ChangePasswordRequest("oldpass1", "newpass9"));

        Assert.That(action, Is.TypeOf<NoContentResult>());
        Assert.That(auth.LastChangeOrganizerId, Is.EqualTo(organizerId));
        AssertAuthCookieDeleted(controller.Response);
    }

    [Test]
    public async Task ChangePassword_MapsUnauthorized_To401()
    {
        var auth = new StubAuthService
        {
            ChangeResult = new PasswordMutationResult(
                false,
                PasswordMutationFailureKind.Unauthorized,
                AuthConstants.WrongCurrentPasswordMessage),
        };
        var controller = CreateController(auth, Guid.NewGuid());

        var action = await controller.ChangePassword(new ChangePasswordRequest("wrong", "newpass9"));

        Assert.That(action, Is.TypeOf<UnauthorizedObjectResult>());
    }

    [Test]
    public async Task ChangePassword_MapsNotAllowed_To400()
    {
        var auth = new StubAuthService
        {
            ChangeResult = new PasswordMutationResult(
                false,
                PasswordMutationFailureKind.NotAllowed,
                AuthConstants.ChangePasswordOAuthOnlyMessage),
        };
        var controller = CreateController(auth, Guid.NewGuid());

        var action = await controller.ChangePassword(new ChangePasswordRequest("old", "newpass9"));

        Assert.That(action, Is.TypeOf<BadRequestObjectResult>());
    }

    [Test]
    public async Task ChangePassword_WithoutOrganizerId_Returns401()
    {
        var auth = new StubAuthService
        {
            ChangeResult = new PasswordMutationResult(true, null, null),
        };
        var controller = CreateController(auth, organizerId: null);

        var action = await controller.ChangePassword(new ChangePasswordRequest("old", "newpass9"));

        Assert.That(action, Is.TypeOf<UnauthorizedResult>());
    }

    private static AuthController CreateController(StubAuthService authService, Guid? organizerId = null)
    {
        var httpContext = new DefaultHttpContext();
        if (organizerId.HasValue)
        {
            httpContext.Items["OrganizerId"] = organizerId.Value;
        }

        var controller = new AuthController(
            authService,
            new UnusedOAuthService(),
            new StubOAuthStateService(),
            new TestOrganizerSessionRepository(),
            new ConfigurationBuilder().Build(),
            NullLogger<AuthController>.Instance)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = httpContext,
            },
        };
        return controller;
    }

    private static void AssertAuthCookieDeleted(HttpResponse response)
    {
        var prefix = AuthConstants.AuthCookieName + "=";
        var setCookie = response.Headers.SetCookie
            .FirstOrDefault(v =>
                v != null && v.StartsWith(prefix, StringComparison.OrdinalIgnoreCase));

        Assert.That(setCookie, Is.Not.Null.And.Not.Empty);

        var valueAndAttrs = setCookie![prefix.Length..];
        Assert.That(valueAndAttrs.StartsWith(';'), Is.True, "Expected empty cookie value for delete");

        var isExpired =
            setCookie.Contains("expires=", StringComparison.OrdinalIgnoreCase)
            || setCookie.Contains("max-age=0", StringComparison.OrdinalIgnoreCase);
        Assert.That(isExpired, Is.True, "Expected expires or max-age=0 on deleted cookie");
    }

    private sealed class StubAuthService : IAuthService
    {
        public ForgotPasswordResult ForgotResult { get; set; } =
            new(true, false, AuthConstants.ForgotPasswordGenericMessage, null);

        public PasswordMutationResult ResetResult { get; set; } = new(true, null, null);
        public PasswordMutationResult ChangeResult { get; set; } = new(true, null, null);
        public Guid? LastChangeOrganizerId { get; private set; }

        public Task<AuthResult> RegisterAsync(string email, string password, string name) =>
            throw new NotSupportedException();

        public Task<AuthResult> LoginAsync(string email, string password) =>
            throw new NotSupportedException();

        public Task<Organizer> ProcessOAuthCallbackAsync(
            OAuthProvider provider,
            string code,
            string redirectUri,
            string? deviceId = null) =>
            throw new NotSupportedException();

        public Task<string> GenerateTokenAsync(Organizer organizer) => Task.FromResult("jwt");

        public Task<ForgotPasswordResult> ForgotPasswordAsync(string email) =>
            Task.FromResult(ForgotResult);

        public Task<PasswordMutationResult> ResetPasswordAsync(string token, string newPassword) =>
            Task.FromResult(ResetResult);

        public Task<PasswordMutationResult> ChangePasswordAsync(
            Guid organizerId,
            string oldPassword,
            string newPassword)
        {
            LastChangeOrganizerId = organizerId;
            return Task.FromResult(ChangeResult);
        }
    }

    private sealed class StubOAuthStateService : IOAuthStateService
    {
        public string GenerateAndStoreState(string provider) => "state";
        public bool ValidateAndConsumeState(string? state, string expectedProvider) => true;
    }
}

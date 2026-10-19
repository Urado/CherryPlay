using CherryPlayServer.Core.Attributes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CherryPlayServer.Tests;

[TestFixture]
[Category("AdminPartyUnit")]
public sealed class AdminAuthorizationPolicyShapeTests
{
    [Test]
    public void EveryAdminController_RequiresAdminAuthorization()
    {
        var controllerRoutes = typeof(Program).Assembly.GetTypes()
            .Where(type => !type.IsAbstract && typeof(ControllerBase).IsAssignableFrom(type))
            .SelectMany(type => type.GetCustomAttributes(typeof(RouteAttribute), inherit: true)
                .Cast<RouteAttribute>()
                .Select(route => (Controller: type, route.Template)))
            .Where(entry => entry.Template?.StartsWith("api/admin", StringComparison.OrdinalIgnoreCase) == true)
            .ToArray();
        var controllers = controllerRoutes.Select(entry => entry.Controller).Distinct().ToArray();

        var incorrectlyScopedRoutes = controllerRoutes
            .Where(entry => !string.Equals(entry.Template, "api/admin", StringComparison.OrdinalIgnoreCase)
                && entry.Template?.StartsWith("api/admin/", StringComparison.OrdinalIgnoreCase) != true)
            .Select(entry => $"{entry.Controller.Name}:{entry.Template}")
            .ToArray();

        var unsecuredControllers = controllers
            .Where(type => !type.GetCustomAttributes(typeof(AuthorizeAdminAttribute), inherit: true).Any()
                || type.GetCustomAttributes(typeof(AllowAnonymousAttribute), inherit: true).Any())
            .Select(type => type.Name)
            .ToArray();

        Assert.That(controllers, Is.Not.Empty);
        Assert.That(incorrectlyScopedRoutes, Is.Empty, string.Join(", ", incorrectlyScopedRoutes));
        Assert.That(unsecuredControllers, Is.Empty, string.Join(", ", unsecuredControllers));

        var unsecuredActions = controllers
            .SelectMany(type => type.GetMethods().Where(method => method.DeclaringType == type))
            .Where(method => method.GetCustomAttributes(typeof(AllowAnonymousAttribute), inherit: true).Any()
                || method.DeclaringType!.GetCustomAttributes(typeof(AllowAnonymousAttribute), inherit: true).Any())
            .Select(method => $"{method.DeclaringType?.Name}.{method.Name}")
            .ToArray();

        Assert.That(unsecuredActions, Is.Empty, string.Join(", ", unsecuredActions));
    }
}

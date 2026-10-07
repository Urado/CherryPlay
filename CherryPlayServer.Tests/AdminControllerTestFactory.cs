using CherryPlayServer.Controllers;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Infrastructure.Persistence;
using CherryPlayServer.Infrastructure.Persistence.Repositories;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace CherryPlayServer.Tests;

internal static class AdminControllerTestFactory
{
    public static AdminController Create(AppDbContext db, Guid adminId)
    {
        var controller = new AdminController(
            new AdminQueryService(new EfAdminQueryRepository(db)),
            new AdminEntitlementService(new EfAdminEntitlementRepository(db)))
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() },
        };
        controller.HttpContext.Items["OrganizerId"] = adminId;
        return controller;
    }
}

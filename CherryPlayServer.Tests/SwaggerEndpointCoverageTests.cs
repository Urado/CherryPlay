using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Http.Metadata;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Routing.Patterns;
using Microsoft.Extensions.DependencyInjection;

namespace CherryPlayServer.Tests;

[TestFixture]
public sealed class SwaggerEndpointCoverageTests
{
    [Test]
    public async Task SwaggerDocument_ContainsEveryRoutableHttpEndpoint()
    {
        await using var factory = new SessionParityWebApplicationFactory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/swagger/v1/swagger.json");
        var documentJson = await response.Content.ReadAsStringAsync();

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), documentJson);

        using var document = JsonDocument.Parse(documentJson);
        var documentedOperations = document.RootElement
            .GetProperty("paths")
            .EnumerateObject()
            .SelectMany(path => path.Value.EnumerateObject().Select(operation =>
                (Path: path.Name, Method: operation.Name)))
            .ToHashSet();
        var routeEndpoints = factory.Services.GetRequiredService<EndpointDataSource>()
            .Endpoints
            .OfType<RouteEndpoint>()
            .Where(endpoint => !IsExcluded(ToOpenApiPath(endpoint.RoutePattern)))
            .ToArray();

        Assert.That(routeEndpoints, Is.Not.Empty);

        var endpointsWithoutHttpMethods = routeEndpoints
            .Where(endpoint => endpoint.Metadata.GetMetadata<IHttpMethodMetadata>() is null)
            .Select(endpoint => endpoint.RoutePattern.RawText)
            .ToArray();
        Assert.That(endpointsWithoutHttpMethods, Is.Empty, string.Join(Environment.NewLine, endpointsWithoutHttpMethods));

        var undocumentedOperations = routeEndpoints
            .SelectMany(endpoint => endpoint.Metadata.GetMetadata<IHttpMethodMetadata>()!.HttpMethods
                .Select(method => (Path: ToOpenApiPath(endpoint.RoutePattern), Method: method)))
            .Where(operation => !documentedOperations.Any(documented =>
                documented.Path.Equals(operation.Path, StringComparison.Ordinal) &&
                documented.Method.Equals(operation.Method, StringComparison.OrdinalIgnoreCase)))
            .Distinct()
            .ToArray();

        Assert.That(undocumentedOperations, Is.Empty,
            string.Join(Environment.NewLine, undocumentedOperations.Select(operation => $"{operation.Method.ToUpperInvariant()} {operation.Path}")));
    }

    private static bool IsExcluded(string route)
    {
        return IsAtOrBelow(route, "/partyHub") || IsAtOrBelow(route, "/swagger");
    }

    private static bool IsAtOrBelow(string path, string basePath)
    {
        return path.Equals(basePath, StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith(basePath + "/", StringComparison.OrdinalIgnoreCase);
    }

    private static string ToOpenApiPath(RoutePattern routePattern)
    {
        var segments = routePattern.PathSegments.Select(segment => string.Concat(segment.Parts.Select(part =>
            part is RoutePatternParameterPart parameter
                ? $"{{{parameter.Name}}}"
                : ((RoutePatternLiteralPart)part).Content)));

        return "/" + string.Join("/", segments);
    }
}

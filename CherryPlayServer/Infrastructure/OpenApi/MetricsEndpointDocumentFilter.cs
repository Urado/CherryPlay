using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace CherryPlayServer.Infrastructure.OpenApi;

public sealed class MetricsEndpointDocumentFilter : IDocumentFilter
{
    public void Apply(OpenApiDocument swaggerDoc, DocumentFilterContext context)
    {
        swaggerDoc.Paths["/metrics"] = new OpenApiPathItem
        {
            Operations =
            {
                [OperationType.Get] = new OpenApiOperation
                {
                    OperationId = "GetMetrics",
                    Summary = "Get Prometheus metrics",
                    Description = "Returns application and runtime metrics in Prometheus exposition format.",
                    Responses =
                    {
                        ["200"] = new OpenApiResponse { Description = "Prometheus metrics." }
                    }
                }
            }
        };
    }
}

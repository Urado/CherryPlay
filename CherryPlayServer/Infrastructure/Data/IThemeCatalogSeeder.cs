namespace CherryPlayServer.Infrastructure.Data;

public interface IThemeCatalogSeeder
{
    Task SeedAsync(CancellationToken cancellationToken = default);
}

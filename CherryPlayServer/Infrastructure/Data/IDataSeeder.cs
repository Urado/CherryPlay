namespace CherryPlayServer.Infrastructure.Data;

public interface IDataSeeder
{
    Task SeedAsync(CancellationToken cancellationToken = default);
}

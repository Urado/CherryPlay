namespace CherryPlayServer.Infrastructure.Persistence;

internal static class InMemoryUnitOfWorkScope
{
    private static readonly AsyncLocal<InMemoryLegalConsentTransaction?> Ambient = new();

    internal static InMemoryLegalConsentTransaction? Current => Ambient.Value;

    internal static void Begin()
    {
        if (Ambient.Value is not null)
        {
            throw new InvalidOperationException("Nested in-memory transactions are not supported.");
        }

        Ambient.Value = new InMemoryLegalConsentTransaction();
    }

    internal static void Commit(object commitGate)
    {
        ArgumentNullException.ThrowIfNull(commitGate);

        var transaction = Ambient.Value
            ?? throw new InvalidOperationException("No active in-memory transaction to commit.");

        try
        {
            transaction.Commit(commitGate);
        }
        finally
        {
            transaction.Exit();
            Ambient.Value = null;
        }
    }

    internal static void Rollback()
    {
        var transaction = Ambient.Value;
        if (transaction is null)
        {
            return;
        }

        transaction.Exit();
        Ambient.Value = null;
    }
}

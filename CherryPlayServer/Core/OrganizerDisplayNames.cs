namespace CherryPlayServer.Core;

public static class OrganizerDisplayNames
{
    public const string Deleted = "Удалённый пользователь";

    public static string Resolve(string? name) =>
        string.IsNullOrWhiteSpace(name) ? Deleted : name;
}

using System.Text.Json;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace CherryPlayServer.Infrastructure.Persistence.Converters;

public sealed class StringListConverter : ValueConverter<List<string>, string>
{
    public StringListConverter()
        : base(
            v => Serialize(v),
            v => Deserialize(v))
    {
    }

    private static string Serialize(List<string>? v)
    {
        if (v == null || v.Count == 0) return "[]";
        return JsonSerializer.Serialize(v);
    }

    private static List<string> Deserialize(string? v)
    {
        if (string.IsNullOrWhiteSpace(v)) return new List<string>();
        var list = JsonSerializer.Deserialize<List<string>>(v);
        return list ?? new List<string>();
    }
}

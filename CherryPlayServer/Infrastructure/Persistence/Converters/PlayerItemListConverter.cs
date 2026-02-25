using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using CherryPlayServer.Core.Entities;

namespace CherryPlayServer.Infrastructure.Persistence.Converters;

public sealed class PlayerItemListConverter : ValueConverter<List<PlayerItem>, string>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };

    public PlayerItemListConverter()
        : base(
            v => Serialize(v),
            v => Deserialize(v))
    {
    }

    private static string Serialize(List<PlayerItem>? v)
    {
        if (v == null || v.Count == 0) return "[]";
        return JsonSerializer.Serialize(v, JsonOptions);
    }

    private static List<PlayerItem> Deserialize(string? v)
    {
        if (string.IsNullOrWhiteSpace(v)) return new List<PlayerItem>();
        var list = JsonSerializer.Deserialize<List<PlayerItem>>(v, JsonOptions);
        return list ?? new List<PlayerItem>();
    }
}

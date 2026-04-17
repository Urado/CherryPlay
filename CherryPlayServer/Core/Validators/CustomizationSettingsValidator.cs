using System.Text.Json;

namespace CherryPlayServer.Core.Validators;

public static class CustomizationSettingsValidator
{
    public static bool IsValidCustomizationSettings(Dictionary<string, object>? settings)
    {
        return true;
    }

    public static Dictionary<string, object>? NormalizeCustomizationSettings(Dictionary<string, object>? settings)
    {
        if (settings == null)
        {
            return null;
        }

        var normalized = new Dictionary<string, object>();
        foreach (var kvp in settings)
        {
            var value = NormalizeValue(kvp.Value);
            if (value is null)
            {
                continue;
            }

            normalized[kvp.Key] = value;
        }

        return normalized;
    }

    private static object? NormalizeValue(object? value)
    {
        if (value is JsonElement jsonElement)
        {
            return NormalizeJsonElement(jsonElement);
        }

        if (value is Dictionary<string, object> dict)
        {
            return NormalizeCustomizationSettings(dict);
        }

        if (value is List<object> list)
        {
            return list.Select(NormalizeValue).ToList();
        }

        if (value is null ||
            value is string ||
            value is bool ||
            value is int ||
            value is long ||
            value is float ||
            value is double ||
            value is decimal)
        {
            return value;
        }

        return value.ToString();
    }

    private static object? NormalizeJsonElement(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.Object => element
                .EnumerateObject()
                .ToDictionary(
                    property => property.Name,
                    property => NormalizeJsonElement(property.Value)),
            JsonValueKind.Array => element
                .EnumerateArray()
                .Select(NormalizeJsonElement)
                .ToList(),
            JsonValueKind.String => element.GetString(),
            JsonValueKind.Number => element.TryGetInt64(out var longValue)
                ? longValue
                : element.GetDouble(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Null => null,
            _ => null,
        };
    }
}

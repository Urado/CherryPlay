using System.Text.Json;

namespace CherryPlayServer.Core.Validators;

public static class CustomizationSettingsValidator
{
    public static bool IsValidCustomizationSettings(Dictionary<string, object>? settings)
    {
        if (settings == null)
        {
            return true;
        }

        foreach (var kvp in settings)
        {
            var value = kvp.Value;

            if (value is JsonElement jsonElement)
            {
                if (jsonElement.ValueKind == JsonValueKind.String ||
                    jsonElement.ValueKind == JsonValueKind.Number ||
                    jsonElement.ValueKind == JsonValueKind.Null)
                {
                    continue;
                }
                return false;
            }

            if (value is not string && value is not int && value is not long &&
                value is not float && value is not double && value is not decimal)
            {
                if (value == null)
                {
                    continue;
                }
                return false;
            }
        }

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
            var value = kvp.Value;

            if (value is JsonElement jsonElement)
            {
                if (jsonElement.ValueKind == JsonValueKind.String)
                {
                    normalized[kvp.Key] = jsonElement.GetString()!;
                }
                else if (jsonElement.ValueKind == JsonValueKind.Number)
                {
                    if (jsonElement.TryGetInt32(out var intValue))
                    {
                        normalized[kvp.Key] = (double)intValue;
                    }
                    else if (jsonElement.TryGetInt64(out var longValue))
                    {
                        normalized[kvp.Key] = (double)longValue;
                    }
                    else if (jsonElement.TryGetDouble(out var doubleValue))
                    {
                        normalized[kvp.Key] = doubleValue;
                    }
                    else
                    {
                        try
                        {
                            normalized[kvp.Key] = jsonElement.GetDouble();
                        }
                        catch
                        {
                        }
                    }
                }
                continue;
            }

            if (value == null)
            {
                continue;
            }

            if (value is int intVal)
            {
                normalized[kvp.Key] = (double)intVal;
            }
            else if (value is long longVal)
            {
                normalized[kvp.Key] = (double)longVal;
            }
            else if (value is float floatVal)
            {
                normalized[kvp.Key] = (double)floatVal;
            }
            else if (value is decimal decimalVal)
            {
                normalized[kvp.Key] = (double)decimalVal;
            }
            else if (value is string || value is double)
            {
                normalized[kvp.Key] = value;
            }
        }

        return normalized;
    }
}

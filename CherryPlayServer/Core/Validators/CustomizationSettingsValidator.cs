using System.Text.Json;

namespace CherryPlayServer.Core.Validators;

public static class CustomizationSettingsValidator
{
    /// <summary>
    /// Валидирует, что все значения в customizationSettings имеют тип string или number (int/double).
    /// </summary>
    public static bool IsValidCustomizationSettings(Dictionary<string, object>? settings)
    {
        if (settings == null)
        {
            return true; // null допустим
        }

        foreach (var kvp in settings)
        {
            var value = kvp.Value;

            // Обработка JsonElement (может появиться при десериализации)
            if (value is JsonElement jsonElement)
            {
                if (jsonElement.ValueKind == JsonValueKind.String)
                {
                    continue; // Строка допустима
                }
                else if (jsonElement.ValueKind == JsonValueKind.Number)
                {
                    continue; // Число допустимо
                }
                else if (jsonElement.ValueKind == JsonValueKind.Null)
                {
                    continue; // null допустим (будет пропущен при нормализации)
                }
                else
                {
                    return false; // Другие типы JsonElement недопустимы
                }
            }

            // Проверяем, что значение является string или числом
            if (value is not string && value is not int && value is not long &&
                value is not float && value is not double && value is not decimal)
            {
                // null допустим (будет пропущен при нормализации)
                if (value == null)
                {
                    continue;
                }
                return false;
            }
        }

        return true;
    }

    /// <summary>
    /// Нормализует значения в customizationSettings, приводя числа к double где необходимо.
    /// </summary>
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

            // Обработка JsonElement (может появиться при десериализации)
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
                }
                // Пропускаем null и другие типы JsonElement
                continue;
            }

            // Пропускаем null значения
            if (value == null)
            {
                continue;
            }

            // Приводим все числовые типы к double для единообразия
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
            // Пропускаем невалидные значения
        }

        return normalized;
    }
}

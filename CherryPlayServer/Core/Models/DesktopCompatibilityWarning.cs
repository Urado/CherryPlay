using System.Text.Json.Serialization;

namespace CherryPlayServer.Core.Models;

public record DesktopCompatibilityWarning(
    [property: JsonPropertyName("minVersion")] string MinVersion,
    [property: JsonPropertyName("serverVersion")] string ServerVersion);

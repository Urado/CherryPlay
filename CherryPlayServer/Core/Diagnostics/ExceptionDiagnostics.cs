using System.Diagnostics;
namespace CherryPlayServer.Core.Diagnostics;

public static class ExceptionDiagnostics
{
    private const int MaximumLocationLength = 512;
    private const int MaximumFrameCount = 6;

    public static string GetFailureLocation(Exception exception)
    {
        var frames = new StackTrace(exception, false).GetFrames();
        if (frames is null || frames.Length == 0)
        {
            return "unavailable";
        }

        var locations = frames
            .Take(MaximumFrameCount)
            .Select(GetFrameLocation)
            .Where(location => location.Length > 0);
        var location = string.Join(" > ", locations);
        if (location.Length == 0)
        {
            location = "unavailable";
        }

        var result = $"{exception.GetType().Name}: {location}";
        return result.Length <= MaximumLocationLength
            ? result
            : result[..MaximumLocationLength];
    }

    private static string GetFrameLocation(StackFrame frame)
    {
        var method = frame.GetMethod();
        if (method is null)
        {
            return string.Empty;
        }

        var declaringType = method.DeclaringType?.FullName;
        var methodName = method.Name;
        var location = string.IsNullOrEmpty(declaringType)
            ? methodName
            : $"{declaringType}.{methodName}";

        return frame.GetILOffset() >= 0
            ? $"{location}@il{frame.GetILOffset()}"
            : location;
    }
}

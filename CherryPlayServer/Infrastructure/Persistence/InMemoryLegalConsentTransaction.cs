using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Infrastructure.Persistence;

internal sealed class InMemoryLegalConsentTransaction
{
    private readonly List<Action<ICollection<Action>>> _applyActions = new();
    private readonly List<Action> _exitActions = new();
    private readonly HashSet<object> _participants = new();

    public Dictionary<Guid, ConsentEvent> ConsentAdds { get; } = new();
    public HashSet<Guid> ConsentRemoves { get; } = new();

    public Dictionary<Guid, Organizer> OrganizerAdds { get; } = new();
    public HashSet<Guid> OrganizerRemoves { get; } = new();

    public Dictionary<Guid, EmailAccount> EmailAdds { get; } = new();
    public Dictionary<string, Guid> EmailIndexAdds { get; } = new(StringComparer.OrdinalIgnoreCase);
    public HashSet<Guid> EmailRemoves { get; } = new();
    public HashSet<string> EmailIndexRemoves { get; } = new(StringComparer.OrdinalIgnoreCase);
    public HashSet<string> HeldEmailLocks { get; } = new(StringComparer.OrdinalIgnoreCase);

    public Dictionary<Guid, OAuthAccount> OAuthAdds { get; } = new();
    public Dictionary<(OAuthProvider Provider, string ProviderUserId), Guid> OAuthIndexAdds { get; } = new();
    public HashSet<Guid> OAuthRemoves { get; } = new();
    public HashSet<(OAuthProvider Provider, string ProviderUserId)> OAuthIndexRemoves { get; } = new();
    public HashSet<(OAuthProvider Provider, string ProviderUserId)> HeldOAuthLocks { get; } = new();

    public void RegisterParticipant(object participant, Action<ICollection<Action>> apply)
    {
        if (_participants.Add(participant))
        {
            _applyActions.Add(apply);
        }
    }

    public void OnExit(Action action)
    {
        ArgumentNullException.ThrowIfNull(action);
        _exitActions.Add(action);
    }

    public void Commit(object commitGate)
    {
        ArgumentNullException.ThrowIfNull(commitGate);

        lock (commitGate)
        {
            var undos = new List<Action>();
            try
            {
                foreach (var apply in _applyActions)
                {
                    apply(undos);
                }
            }
            catch
            {
                for (var i = undos.Count - 1; i >= 0; i--)
                {
                    undos[i]();
                }

                throw;
            }
        }
    }

    public void Exit()
    {
        for (var i = _exitActions.Count - 1; i >= 0; i--)
        {
            _exitActions[i]();
        }

        _exitActions.Clear();
    }
}

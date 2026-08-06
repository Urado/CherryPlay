namespace CherryPlayServer.Core.Interfaces;

public interface IPasswordResetApplicator
{
    Task<bool> ApplyAsync(Guid tokenId, Guid emailAccountId, string newPasswordHash);

    Task ApplyPasswordChangeAsync(Guid emailAccountId, Guid organizerId, string newPasswordHash);
}

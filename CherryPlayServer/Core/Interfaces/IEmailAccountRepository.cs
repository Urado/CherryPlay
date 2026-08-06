using CherryPlayServer.Core.Entities;

namespace CherryPlayServer.Core.Interfaces;

public interface IEmailAccountRepository
{
    Task<EmailAccount?> GetByIdAsync(Guid id);
    Task<EmailAccount?> GetByEmailAsync(string email);
    Task<EmailAccount?> GetByOrganizerIdAsync(Guid organizerId);
    Task<EmailAccount> AddAsync(EmailAccount account);
    Task UpdateAsync(EmailAccount account);
}

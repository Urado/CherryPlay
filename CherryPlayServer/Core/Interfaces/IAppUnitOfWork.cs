namespace CherryPlayServer.Core.Interfaces;

public interface IAppUnitOfWork : IUnitOfWork
{
    IOrganizerRepository Organizers { get; }
    IEmailAccountRepository EmailAccounts { get; }
    IOAuthAccountRepository OAuthAccounts { get; }
    IOrganizerSessionRepository Sessions { get; }
}

namespace CherryPlayServer.Core.Interfaces;

public interface ILegalConsentUnitOfWork : IUnitOfWork
{
    IOrganizerRepository Organizers { get; }
    IEmailAccountRepository EmailAccounts { get; }
    IOAuthAccountRepository OAuthAccounts { get; }
    IConsentEventRepository ConsentEvents { get; }
    ILegalDocumentVersionRepository DocumentVersions { get; }
}

using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Core.Services;

public class DesktopAuthCodeService : IDesktopAuthCodeService
{
    private readonly IDesktopAuthCodeRepository _repository;
    private readonly IOrganizerRepository _organizerRepository;
    private readonly IAuthService _authService;

    public DesktopAuthCodeService(
        IDesktopAuthCodeRepository repository,
        IOrganizerRepository organizerRepository,
        IAuthService authService)
    {
        _repository = repository ?? throw new ArgumentNullException(nameof(repository));
        _organizerRepository = organizerRepository ?? throw new ArgumentNullException(nameof(organizerRepository));
        _authService = authService ?? throw new ArgumentNullException(nameof(authService));
    }

    public async Task<string> IssueCodeAsync(Guid organizerId)
    {
        var rawCode = PasswordResetTokenHelper.GenerateRawToken();
        var tokenHash = PasswordResetTokenHelper.HashToken(rawCode);
        var now = DateTime.UtcNow;

        await _repository.AddAsync(new DesktopAuthCode
        {
            Id = Guid.NewGuid(),
            OrganizerId = organizerId,
            TokenHash = tokenHash,
            ExpiresAt = now.Add(AuthConstants.DesktopAuthCodeTtl),
            CreatedAt = now,
        });

        return rawCode;
    }

    public async Task<string?> ExchangeAsync(string rawCode)
    {
        if (string.IsNullOrWhiteSpace(rawCode))
        {
            return null;
        }

        var tokenHash = PasswordResetTokenHelper.HashToken(rawCode);
        var stored = await _repository.GetValidByTokenHashAsync(tokenHash);
        if (stored == null)
        {
            return null;
        }

        if (!await _repository.TryMarkUsedAsync(stored.Id))
        {
            return null;
        }

        var organizer = await _organizerRepository.GetByIdAsync(stored.OrganizerId);
        if (organizer == null)
        {
            return null;
        }

        return await _authService.GenerateTokenAsync(organizer);
    }
}

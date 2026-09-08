using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;
using CherryPlayServer.Infrastructure.Persistence.Mappings;
using Microsoft.EntityFrameworkCore;

namespace CherryPlayServer.Infrastructure.Persistence.Repositories;

public class EfLegalDocumentVersionRepository : ILegalDocumentVersionRepository
{
    private readonly AppDbContext _context;

    public EfLegalDocumentVersionRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<LegalDocumentVersionInfo>> ListAsync(
        CancellationToken cancellationToken = default)
    {
        var rows = await _context.LegalDocumentVersions
            .AsNoTracking()
            .ToListAsync(cancellationToken);
        return rows.Select(r => r.ToInfo()).ToList();
    }

    public async Task<LegalDocumentVersionInfo?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var ef = await _context.LegalDocumentVersions
            .AsNoTracking()
            .FirstOrDefaultAsync(v => v.Id == id, cancellationToken);
        return ef?.ToInfo();
    }
}

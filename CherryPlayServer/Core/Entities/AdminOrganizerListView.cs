namespace CherryPlayServer.Core.Entities;

public record AdminOrganizerListView(IReadOnlyList<AdminOrganizerListItemView> Items, int Total, int Page, int PageSize);

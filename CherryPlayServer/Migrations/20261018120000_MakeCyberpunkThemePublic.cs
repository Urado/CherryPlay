using CherryPlayServer.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CherryPlayServer.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20261018120000_MakeCyberpunkThemePublic")]
    public partial class MakeCyberpunkThemePublic : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "UPDATE themes SET visibility = 'public' WHERE theme_id = 'cyberpunk';");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "UPDATE themes SET visibility = 'private' WHERE theme_id = 'cyberpunk';");
        }
    }
}

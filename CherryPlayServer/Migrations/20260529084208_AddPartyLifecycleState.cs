using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CherryPlayServer.Migrations
{
    public partial class AddPartyLifecycleState : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "party_lifecycle_state",
                table: "parties",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.Sql(
                """
                UPDATE parties
                SET party_lifecycle_state = CASE
                    WHEN event_date_time IS NOT NULL AND event_date_time < NOW() THEN 3
                    ELSE 2
                END;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "party_lifecycle_state",
                table: "parties");
        }
    }
}

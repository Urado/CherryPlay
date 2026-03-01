using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CherryPlayServer.Migrations
{
    /// <inheritdoc />
    public partial class AddPartyCardFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "dance_tags_json",
                table: "parties",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "external_link_text",
                table: "parties",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "external_link_url",
                table: "parties",
                type: "character varying(2048)",
                maxLength: 2048,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "short_description",
                table: "parties",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "dance_tags_json",
                table: "parties");

            migrationBuilder.DropColumn(
                name: "external_link_text",
                table: "parties");

            migrationBuilder.DropColumn(
                name: "external_link_url",
                table: "parties");

            migrationBuilder.DropColumn(
                name: "short_description",
                table: "parties");
        }
    }
}

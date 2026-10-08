using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CherryPlayServer.Migrations
{
    /// <inheritdoc />
    public partial class SyncLegalRegistryCloudRu : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "legal_document_versions",
                keyColumn: "id",
                keyValue: new Guid("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                column: "content_hash",
                value: "af8342b074c03628bc3ca3d68e5f3166583c7e9ab33b9bb9accb0953eec95030");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "legal_document_versions",
                keyColumn: "id",
                keyValue: new Guid("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                column: "content_hash",
                value: "0e230cf6103646fa81429dd0ae4c79142223a421ed2314109d9a8244ed161991");
        }
    }
}

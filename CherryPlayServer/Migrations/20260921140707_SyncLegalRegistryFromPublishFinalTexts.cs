using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CherryPlayServer.Migrations
{
    /// <inheritdoc />
    public partial class SyncLegalRegistryFromPublishFinalTexts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "legal_document_versions",
                keyColumn: "id",
                keyValue: new Guid("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                columns: new[] { "content_hash", "effective_from" },
                values: new object[] { "0e230cf6103646fa81429dd0ae4c79142223a421ed2314109d9a8244ed161991", new DateTime(2026, 9, 21, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "legal_document_versions",
                keyColumn: "id",
                keyValue: new Guid("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
                columns: new[] { "content_hash", "effective_from" },
                values: new object[] { "c4e35d3232b9a425d2d448c28258a4fa472911c7470e3e588c491c3139f0955e", new DateTime(2026, 9, 21, 0, 0, 0, 0, DateTimeKind.Utc) });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "legal_document_versions",
                keyColumn: "id",
                keyValue: new Guid("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                columns: new[] { "content_hash", "effective_from" },
                values: new object[] { "fa1dce859b02aaaa13069568901e9bc4e1f3ed10ac21c879c79dcca8f750c7f4", new DateTime(2026, 9, 1, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "legal_document_versions",
                keyColumn: "id",
                keyValue: new Guid("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
                columns: new[] { "content_hash", "effective_from" },
                values: new object[] { "15fc3818f58e97fc77734281df27237cee7499409758995d8a1499d1f793deb6", new DateTime(2026, 9, 1, 0, 0, 0, 0, DateTimeKind.Utc) });
        }
    }
}

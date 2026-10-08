using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CherryPlayServer.Migrations
{
    /// <inheritdoc />
    public partial class SyncLegalDocumentHasDataWithRegistry : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "legal_document_versions",
                keyColumn: "id",
                keyValue: new Guid("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                columns: new[] { "content_hash", "document_version", "effective_from" },
                values: new object[] { "f4c9dcba9ed36f7cfe1087c1e2dc7535008df71cd3ad95bced47f6278092de46", "1.0", new DateTime(2026, 9, 1, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "legal_document_versions",
                keyColumn: "id",
                keyValue: new Guid("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
                columns: new[] { "content_hash", "document_version", "effective_from" },
                values: new object[] { "889f4423294937c7b0a40fbdb2c6d10dc69d3e44c0ed19338b6a22bacb6ab018", "1.0", new DateTime(2026, 9, 1, 0, 0, 0, 0, DateTimeKind.Utc) });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "legal_document_versions",
                keyColumn: "id",
                keyValue: new Guid("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                columns: new[] { "content_hash", "document_version", "effective_from" },
                values: new object[] { "pd-consent-hash-v1", "v1", new DateTime(1970, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "legal_document_versions",
                keyColumn: "id",
                keyValue: new Guid("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
                columns: new[] { "content_hash", "document_version", "effective_from" },
                values: new object[] { "terms-hash-v1", "v1", new DateTime(1970, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc) });
        }
    }
}

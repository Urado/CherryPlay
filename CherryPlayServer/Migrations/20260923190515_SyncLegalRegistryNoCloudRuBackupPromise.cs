using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CherryPlayServer.Migrations
{
    /// <inheritdoc />
    public partial class SyncLegalRegistryNoCloudRuBackupPromise : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "legal_document_versions",
                keyColumn: "id",
                keyValue: new Guid("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                column: "content_hash",
                value: "55f3ad89784ab028a741ea44345971e40804488b21392f7f9d4b30b3644444ff");

            migrationBuilder.UpdateData(
                table: "legal_document_versions",
                keyColumn: "id",
                keyValue: new Guid("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
                column: "content_hash",
                value: "c9290febb6dce3229775dba33b7a766a09f769963f82331ccd34dc274f32334d");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "legal_document_versions",
                keyColumn: "id",
                keyValue: new Guid("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                column: "content_hash",
                value: "c5e48185d7de771c5bd175f2c07e6ff6e081cda28610b275e1b4345b278ad8f1");

            migrationBuilder.UpdateData(
                table: "legal_document_versions",
                keyColumn: "id",
                keyValue: new Guid("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
                column: "content_hash",
                value: "1fdee5649aa7b13ebd909da3de5fa5503103b139c13dff7ed312f52d72512fff");
        }
    }
}

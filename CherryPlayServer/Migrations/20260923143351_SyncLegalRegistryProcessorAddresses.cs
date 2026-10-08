using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CherryPlayServer.Migrations
{
    /// <inheritdoc />
    public partial class SyncLegalRegistryProcessorAddresses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "legal_document_versions",
                keyColumn: "id",
                keyValue: new Guid("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                column: "content_hash",
                value: "2cdeb1176caf020a42e92e302f016d8dbe4a81dc89838218b92ce655bb6d14a3");

            migrationBuilder.UpdateData(
                table: "legal_document_versions",
                keyColumn: "id",
                keyValue: new Guid("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
                column: "content_hash",
                value: "6dffebc1d8cbd1b32d0f21ae2b438a58917e52c06612255049e6f00174c6d399");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "legal_document_versions",
                keyColumn: "id",
                keyValue: new Guid("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                column: "content_hash",
                value: "f6345d2b09fd150ede840c186389f1e96e13a3e76a93c01b67cff2f0752c5b89");

            migrationBuilder.UpdateData(
                table: "legal_document_versions",
                keyColumn: "id",
                keyValue: new Guid("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
                column: "content_hash",
                value: "4acaf5e4607948123abde3048ef1994c4ddbd04e80544a309c61cda67b5c1e67");
        }
    }
}

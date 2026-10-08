using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace CherryPlayServer.Migrations
{
    /// <inheritdoc />
    public partial class AddLegalConsentTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "legal_document_versions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    document_type = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    document_version = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    content_hash = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    effective_from = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    effective_to = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_legal_document_versions", x => x.id);
                    table.CheckConstraint("ck_legal_document_versions_document_type", "document_type IN ('pd_consent_text','terms','privacy_policy','cookie_policy')");
                    table.CheckConstraint("ck_legal_document_versions_status", "status IN ('draft','active','retired')");
                });

            migrationBuilder.CreateTable(
                name: "consent_events",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    subject_id = table.Column<Guid>(type: "uuid", nullable: false),
                    legal_document_version_id = table.Column<Guid>(type: "uuid", nullable: false),
                    document_hash = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    decision = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    event_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_consent_events", x => x.id);
                    table.CheckConstraint("ck_consent_events_decision", "decision IN ('grant','withdraw','deny')");
                    table.ForeignKey(
                        name: "fk_consent_events_legal_document_versions_legal_document_versi",
                        column: x => x.legal_document_version_id,
                        principalTable: "legal_document_versions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_consent_events_organizers_subject_id",
                        column: x => x.subject_id,
                        principalTable: "organizers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.InsertData(
                table: "legal_document_versions",
                columns: new[] { "id", "content_hash", "document_type", "document_version", "effective_from", "effective_to", "status" },
                values: new object[,]
                {
                    { new Guid("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"), "pd-consent-hash-v1", "pd_consent_text", "v1", new DateTime(1970, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), null, "active" },
                    { new Guid("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"), "terms-hash-v1", "terms", "v1", new DateTime(1970, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), null, "active" },
                    { new Guid("cccccccc-cccc-cccc-cccc-cccccccccccc"), "pd-consent-hash-v1", "pd_consent_text", "v0", new DateTime(1970, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2024, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "retired" }
                });

            migrationBuilder.CreateIndex(
                name: "ix_consent_events_legal_document_version_id",
                table: "consent_events",
                column: "legal_document_version_id");

            migrationBuilder.CreateIndex(
                name: "ix_consent_events_subject_id_event_at",
                table: "consent_events",
                columns: new[] { "subject_id", "event_at" });

            migrationBuilder.CreateIndex(
                name: "ix_consent_events_subject_id_legal_document_version_id",
                table: "consent_events",
                columns: new[] { "subject_id", "legal_document_version_id" });

            migrationBuilder.CreateIndex(
                name: "ix_legal_document_versions_document_type_document_version",
                table: "legal_document_versions",
                columns: new[] { "document_type", "document_version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_legal_document_versions_one_active_per_type",
                table: "legal_document_versions",
                column: "document_type",
                unique: true,
                filter: "status = 'active'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "consent_events");

            migrationBuilder.DropTable(
                name: "legal_document_versions");
        }
    }
}

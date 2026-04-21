using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CherryPlayServer.Migrations
{
    /// <inheritdoc />
    public partial class AddThemeMonetizationBackend : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "role",
                table: "organizers",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "organizer");

            migrationBuilder.AddCheckConstraint(
                name: "ck_organizers_role",
                table: "organizers",
                sql: "role IN ('organizer','admin')");

            migrationBuilder.CreateTable(
                name: "admin_audit_log",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    admin_id = table.Column<Guid>(type: "uuid", nullable: false),
                    action = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    target_organizer_id = table.Column<Guid>(type: "uuid", nullable: true),
                    package_id = table.Column<Guid>(type: "uuid", nullable: true),
                    entitlement_id = table.Column<Guid>(type: "uuid", nullable: true),
                    note = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_admin_audit_log", x => x.id);
                    table.ForeignKey(
                        name: "fk_admin_audit_log_organizers_admin_id",
                        column: x => x.admin_id,
                        principalTable: "organizers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_admin_audit_log_organizers_target_organizer_id",
                        column: x => x.target_organizer_id,
                        principalTable: "organizers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "organizer_entitlements",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organizer_id = table.Column<Guid>(type: "uuid", nullable: false),
                    package_id = table.Column<Guid>(type: "uuid", nullable: false),
                    kind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false, defaultValue: "lifetime"),
                    source = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false, defaultValue: "admin_grant"),
                    granted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    uses_remaining = table.Column<int>(type: "integer", nullable: true),
                    revoked_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    note = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_organizer_entitlements", x => x.id);
                    table.ForeignKey(
                        name: "fk_organizer_entitlements_organizers_organizer_id",
                        column: x => x.organizer_id,
                        principalTable: "organizers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "theme_packages",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    name = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    is_auto_granted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_theme_packages", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "themes",
                columns: table => new
                {
                    theme_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    display_name = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    visibility = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false, defaultValue: "public")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_themes", x => x.theme_id);
                });

            migrationBuilder.AddCheckConstraint(
                name: "ck_admin_audit_log_action",
                table: "admin_audit_log",
                sql: "action IN ('grant_package','revoke_package')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_organizer_entitlements_kind",
                table: "organizer_entitlements",
                sql: "kind IN ('lifetime','subscription','event_quota')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_organizer_entitlements_source",
                table: "organizer_entitlements",
                sql: "source IN ('admin_grant','purchase','trial')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_themes_visibility",
                table: "themes",
                sql: "visibility IN ('public','private')");

            migrationBuilder.CreateTable(
                name: "theme_package_items",
                columns: table => new
                {
                    package_id = table.Column<Guid>(type: "uuid", nullable: false),
                    theme_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_theme_package_items", x => new { x.package_id, x.theme_id });
                    table.ForeignKey(
                        name: "fk_theme_package_items_theme_packages_package_id",
                        column: x => x.package_id,
                        principalTable: "theme_packages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_theme_package_items_themes_theme_id",
                        column: x => x.theme_id,
                        principalTable: "themes",
                        principalColumn: "theme_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.AddForeignKey(
                name: "fk_admin_audit_log_organizer_entitlements_entitlement_id",
                table: "admin_audit_log",
                column: "entitlement_id",
                principalTable: "organizer_entitlements",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "fk_admin_audit_log_theme_packages_package_id",
                table: "admin_audit_log",
                column: "package_id",
                principalTable: "theme_packages",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "fk_organizer_entitlements_theme_packages_package_id",
                table: "organizer_entitlements",
                column: "package_id",
                principalTable: "theme_packages",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.CreateIndex(
                name: "ix_admin_audit_log_admin_id",
                table: "admin_audit_log",
                column: "admin_id");

            migrationBuilder.CreateIndex(
                name: "ix_admin_audit_log_created_at",
                table: "admin_audit_log",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "ix_admin_audit_log_entitlement_id",
                table: "admin_audit_log",
                column: "entitlement_id");

            migrationBuilder.CreateIndex(
                name: "ix_admin_audit_log_package_id",
                table: "admin_audit_log",
                column: "package_id");

            migrationBuilder.CreateIndex(
                name: "ix_admin_audit_log_target_organizer_id",
                table: "admin_audit_log",
                column: "target_organizer_id");

            migrationBuilder.CreateIndex(
                name: "ix_organizer_entitlements_expires_at",
                table: "organizer_entitlements",
                column: "expires_at");

            migrationBuilder.CreateIndex(
                name: "ix_organizer_entitlements_organizer_id",
                table: "organizer_entitlements",
                column: "organizer_id");

            migrationBuilder.CreateIndex(
                name: "ix_organizer_entitlements_organizer_id_package_id_revoked_at",
                table: "organizer_entitlements",
                columns: new[] { "organizer_id", "package_id", "revoked_at" });

            migrationBuilder.CreateIndex(
                name: "ix_organizer_entitlements_package_id",
                table: "organizer_entitlements",
                column: "package_id");

            migrationBuilder.CreateIndex(
                name: "ix_theme_package_items_theme_id",
                table: "theme_package_items",
                column: "theme_id");

            migrationBuilder.CreateIndex(
                name: "ix_theme_packages_code",
                table: "theme_packages",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_theme_packages_is_active",
                table: "theme_packages",
                column: "is_active");

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_admin_audit_log_action",
                table: "admin_audit_log");

            migrationBuilder.DropCheckConstraint(
                name: "ck_organizer_entitlements_kind",
                table: "organizer_entitlements");

            migrationBuilder.DropCheckConstraint(
                name: "ck_organizer_entitlements_source",
                table: "organizer_entitlements");

            migrationBuilder.DropCheckConstraint(
                name: "ck_themes_visibility",
                table: "themes");

            migrationBuilder.DropCheckConstraint(
                name: "ck_organizers_role",
                table: "organizers");

            migrationBuilder.DropTable(
                name: "admin_audit_log");

            migrationBuilder.DropTable(
                name: "organizer_entitlements");

            migrationBuilder.DropTable(
                name: "theme_package_items");

            migrationBuilder.DropTable(
                name: "theme_packages");

            migrationBuilder.DropTable(
                name: "themes");

            migrationBuilder.DropColumn(
                name: "role",
                table: "organizers");
        }
    }
}

using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SharpMind.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCourseMedia : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CourseMedia",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CourseId = table.Column<int>(type: "integer", nullable: false),
                    ModuleKey = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    Title = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Transcript = table.Column<string>(type: "character varying(12000)", maxLength: 12000, nullable: false),
                    Length = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CourseMedia", x => x.Id);
                    table.CheckConstraint("CK_Media_Length", "\"Length\" > 0 AND \"Length\" <= 104857600");
                    table.ForeignKey(
                        name: "FK_CourseMedia_Courses_CourseId",
                        column: x => x.CourseId,
                        principalTable: "Courses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CourseMedia_CourseId_ModuleKey",
                table: "CourseMedia",
                columns: new[] { "CourseId", "ModuleKey" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CourseMedia");
        }
    }
}

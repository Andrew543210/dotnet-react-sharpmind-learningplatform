using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SharpMind.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCourseSummary : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Minutes",
                table: "Courses",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ModuleCount",
                table: "Courses",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // Existing courses keep their programme; the summary columns are derived from it once.
            migrationBuilder.Sql("""
                UPDATE "Courses" SET
                    "ModuleCount" = jsonb_array_length("CurriculumJson" -> 'modules'),
                    "Minutes" = (SELECT COALESCE(SUM((m ->> 'minutes')::integer), 0)
                                 FROM jsonb_array_elements("CurriculumJson" -> 'modules') AS m)
                WHERE jsonb_typeof("CurriculumJson" -> 'modules') = 'array';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Minutes",
                table: "Courses");

            migrationBuilder.DropColumn(
                name: "ModuleCount",
                table: "Courses");
        }
    }
}

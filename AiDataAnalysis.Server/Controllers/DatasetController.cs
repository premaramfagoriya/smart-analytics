using CsvHelper;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using System.Globalization;
using System.Data;

namespace AiDataAnalysis.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DatasetController : ControllerBase
    {
        private readonly IConfiguration _config;

        public DatasetController(IConfiguration config)
        {
            _config = config;
        }

        private NpgsqlConnection GetConnection()
        {
            return new NpgsqlConnection(
                _config.GetConnectionString("DefaultConnection"));
        }

        // ===============================
        // UPLOAD CSV
        // ===============================
        [HttpPost("upload")]
        public async Task<IActionResult> Upload(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest("File is empty");

            var tableName = "dataset_" + DateTime.Now.Ticks;
            var fileName = file.FileName;

            using var stream = new StreamReader(file.OpenReadStream());
            using var csv = new CsvReader(stream, CultureInfo.InvariantCulture);
            using var reader = new CsvDataReader(csv);

            using var connection = GetConnection();
            await connection.OpenAsync();

            // Create metadata table if not exists
            var metaTableSql = @"
                CREATE TABLE IF NOT EXISTS datasets (
                    id SERIAL PRIMARY KEY,
                    filename TEXT,
                    tablename TEXT,
                    uploadedat TIMESTAMP DEFAULT NOW()
                );";

            await new NpgsqlCommand(metaTableSql, connection).ExecuteNonQueryAsync();

            // Create dynamic table
            var schemaTable = reader.GetSchemaTable();
            var createSql = $"CREATE TABLE \"{tableName}\" (";

            foreach (DataRow row in schemaTable.Rows)
            {
                var colName = row["ColumnName"].ToString();
                createSql += $"\"{colName}\" TEXT,";
            }

            createSql = createSql.TrimEnd(',') + ");";
            await new NpgsqlCommand(createSql, connection).ExecuteNonQueryAsync();

            // Insert rows
            while (reader.Read())
            {
                var columns = string.Join(",",
                    schemaTable.Rows.Cast<DataRow>()
                    .Select(r => $"\"{r["ColumnName"]}\""));

                var values = string.Join(",",
                    schemaTable.Rows.Cast<DataRow>()
                    .Select(r => $"@{r["ColumnName"]}"));

                var insertSql =
                    $"INSERT INTO \"{tableName}\" ({columns}) VALUES ({values});";

                using var cmd = new NpgsqlCommand(insertSql, connection);

                foreach (DataRow row in schemaTable.Rows)
                {
                    var col = row["ColumnName"].ToString();
                    cmd.Parameters.AddWithValue(col, reader[col]?.ToString() ?? "");
                }

                await cmd.ExecuteNonQueryAsync();
            }

            // Save metadata
            var metaSql =
                "INSERT INTO datasets(filename, tablename) VALUES(@f,@t)";

            using var metaCmd = new NpgsqlCommand(metaSql, connection);
            metaCmd.Parameters.AddWithValue("f", fileName);
            metaCmd.Parameters.AddWithValue("t", tableName);
            await metaCmd.ExecuteNonQueryAsync();

            return Ok(new
            {
                message = "File uploaded successfully",
                tableName
            });
        }

        // ===============================
        // LIST DATASETS
        // ===============================
        [HttpGet("list")]
        public IActionResult GetDatasets()
        {
            try
            {
                using var connection = GetConnection();
                connection.Open();

                var cmd = new NpgsqlCommand(
                    "SELECT * FROM datasets ORDER BY uploadedat DESC", connection);

                using var reader = cmd.ExecuteReader();
                var list = new List<object>();

                while (reader.Read())
                {
                    list.Add(new
                    {
                        id = reader["id"],
                        fileName = reader["filename"].ToString(),
                        tableName = reader["tablename"].ToString(),
                        uploadedAt = reader["uploadedat"]
                    });
                }

                return Ok(list);
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // ===============================
        // TABLE DATA (TOP 100)
        // ===============================
        [HttpGet("data/{tableName}")]
        public IActionResult GetTableData(string tableName)
        {
            try
            {
                if (!tableName.StartsWith("dataset_"))
                    return BadRequest("Invalid table name");

                using var connection = GetConnection();
                connection.Open();

                var sql = $"SELECT * FROM \"{tableName}\" LIMIT 100;";
                using var cmd = new NpgsqlCommand(sql, connection);
                using var reader = cmd.ExecuteReader();

                var table = new List<Dictionary<string, object>>();

                while (reader.Read())
                {
                    var row = new Dictionary<string, object>();
                    for (int i = 0; i < reader.FieldCount; i++)
                        row[reader.GetName(i)] = reader.GetValue(i);
                    table.Add(row);
                }

                return Ok(table);
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // ===============================
        // GET COLUMNS
        // ===============================
        [HttpGet("columns/{tableName}")]
        public IActionResult GetColumns(string tableName)
        {
            using var connection = GetConnection();
            connection.Open();

            var sql = $"SELECT * FROM \"{tableName}\" LIMIT 1;";
            using var cmd = new NpgsqlCommand(sql, connection);
            using var reader = cmd.ExecuteReader();

            var columns = new List<string>();
            for (int i = 0; i < reader.FieldCount; i++)
                columns.Add(reader.GetName(i));

            return Ok(columns);
        }

        // ===============================
        // CHART DATA
        // ===============================
        [HttpGet("chart")]
        public IActionResult GetChartData(
            string tableName,
            string xColumn,
            string yColumn)
        {
            using var connection = GetConnection();
            connection.Open();

            var sql = $@"
                SELECT ""{xColumn}"" AS label,
                       SUM(CAST(NULLIF(""{yColumn}"",'') AS DOUBLE PRECISION)) AS value
                FROM ""{tableName}""
                GROUP BY ""{xColumn}""
                ORDER BY value DESC;
            ";

            using var cmd = new NpgsqlCommand(sql, connection);
            using var reader = cmd.ExecuteReader();

            var data = new List<object>();

            while (reader.Read())
            {
                data.Add(new
                {
                    label = reader["label"]?.ToString(),
                    value = reader["value"] ?? 0
                });
            }

            return Ok(data);
        }

        // ===============================
        // INSIGHTS
        // ===============================
        [HttpGet("insights/{tableName}")]
        public IActionResult GetInsights(string tableName)
        {
            try
            {
                using var connection = GetConnection();
                connection.Open();

                // Total rows
                var countCmd =
                    new NpgsqlCommand($"SELECT COUNT(*) FROM \"{tableName}\"", connection);
                int totalRows = Convert.ToInt32(countCmd.ExecuteScalar());

                // Columns
                var colCmd =
                    new NpgsqlCommand($"SELECT * FROM \"{tableName}\" LIMIT 1", connection);

                using var reader = colCmd.ExecuteReader();
                var columns = new List<string>();

                for (int i = 0; i < reader.FieldCount; i++)
                    columns.Add(reader.GetName(i));

                reader.Close();

                // Numeric averages
                var numericAverages = new Dictionary<string, double>();

                foreach (var col in columns)
                {
                    try
                    {
                        var avgSql = $@"
                            SELECT AVG(
                              CAST(NULLIF(""{col}"",'') AS DOUBLE PRECISION)
                            )
                            FROM ""{tableName}""";

                        var avgCmd = new NpgsqlCommand(avgSql, connection);
                        var avg = avgCmd.ExecuteScalar();

                        if (avg != DBNull.Value && avg != null)
                            numericAverages[col] =
                                Math.Round(Convert.ToDouble(avg), 2);
                    }
                    catch { }
                }

                return Ok(new
                {
                    totalRows,
                    totalColumns = columns.Count,
                    numericAverages
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }
    }
}

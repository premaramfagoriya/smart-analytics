import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { Bar, Pie, Line, Doughnut } from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    ArcElement,
    LineElement,
    PointElement,
    Tooltip,
    Legend,
    Title
} from "chart.js";

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    ArcElement,
    LineElement,
    PointElement,
    Tooltip,
    Legend,
    Title
);

const API = "https://localhost:7130/api/Dataset";

export default function ChartBuilder() {
    const [datasets, setDatasets] = useState([]);
    const [columns, setColumns] = useState([]);
    const [table, setTable] = useState("");
    const [xCol, setXCol] = useState("");
    const [yCol, setYCol] = useState("");
    const [chartType, setChartType] = useState("bar");
    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [chartTitle, setChartTitle] = useState("Custom Chart");
    const [colorScheme, setColorScheme] = useState("gradient");
    const [showGrid, setShowGrid] = useState(true);
    const [dataLimit, setDataLimit] = useState(50);
    const [selectedDatasetInfo, setSelectedDatasetInfo] = useState(null);

    // Color schemes
    const colorSchemes = {
        gradient: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'],
        pastel: ['#93c5fd', '#86efac', '#fcd34d', '#fca5a5', '#c4b5fd', '#f9a8d4'],
        vibrant: ['#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#4f46e5'],
        monochrome: ['#6b7280', '#9ca3af', '#d1d5db', '#e5e7eb', '#f3f4f6']
    };

    // Load datasets on mount
    useEffect(() => {
        loadDatasets();
    }, []);

    const loadDatasets = useCallback(async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${API}/list`);
            setDatasets(res.data);
            setError(null);
        } catch (err) {
            setError("Failed to load datasets. Please check your connection.");
            console.error("Error loading datasets:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadColumns = useCallback(async (tableName) => {
        if (!tableName) return;

        try {
            setLoading(true);
            setTable(tableName);

            // Find dataset info
            const dataset = datasets.find(d => d.tableName === tableName);
            setSelectedDatasetInfo(dataset);

            // Set default chart title
            if (dataset) {
                setChartTitle(`${dataset.fileName.replace(/\.[^/.]+$/, "")} Analysis`);
            }

            const res = await axios.get(`${API}/columns/${tableName}`);
            const cols = res.data;
            setColumns(cols);

            // Auto-select first two columns if available
            if (cols.length >= 2) {
                setXCol(cols[0]);
                setYCol(cols[1]);
            } else if (cols.length === 1) {
                setXCol(cols[0]);
                setYCol(cols[0]);
            }

            setError(null);
        } catch (err) {
            setError("Failed to load columns. Please try again.");
            console.error("Error loading columns:", err);
        } finally {
            setLoading(false);
        }
    }, [datasets]);

    const generateChart = async () => {
        if (!table || !xCol || !yCol) {
            setError("Please select a dataset and columns first.");
            return;
        }

        try {
            setLoading(true);
            const res = await axios.get(`${API}/chart`, {
                params: {
                    tableName: table,
                    xColumn: xCol,
                    yColumn: yCol,
                    limit: dataLimit
                }
            });

            if (!res.data || res.data.length === 0) {
                throw new Error("No data available for the selected columns.");
            }

            setChartData(res.data);
            setError(null);
        } catch (err) {
            setError(err.message || "Failed to generate chart. Please check your data.");
            console.error("Error generating chart:", err);
        } finally {
            setLoading(false);
        }
    };

    const downloadChart = () => {
        const canvas = document.getElementById('chart-canvas');
        if (!canvas) return;

        const link = document.createElement('a');
        link.download = `${chartTitle.replace(/\s+/g, '_')}_${new Date().getTime()}.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();
    };

    const resetChart = () => {
        setChartData([]);
        setXCol("");
        setYCol("");
        setChartTitle("Custom Chart");
        setSelectedDatasetInfo(null);
    };

    const getStats = () => {
        if (!chartData.length) return null;

        const values = chartData.map(x => Number(x.value) || 0);
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        const max = Math.max(...values);
        const min = Math.min(...values);

        return { sum, avg, max, min };
    };

    // Prepare chart data
    const chartConfig = {
        labels: chartData.map(x => x.label || x[xCol] || "Unknown"),
        datasets: [{
            label: yCol,
            data: chartData.map(x => Number(x.value) || 0),
            backgroundColor: chartType === 'pie' || chartType === 'doughnut'
                ? colorSchemes[colorScheme]
                : colorSchemes[colorScheme].map(color => `${color}80`),
            borderColor: chartType === 'line'
                ? colorSchemes[colorScheme][0]
                : colorSchemes[colorScheme].map(color => `${color}CC`),
            borderWidth: chartType === 'line' ? 3 : 1,
            tension: chartType === 'line' ? 0.4 : 0,
            fill: chartType === 'line',
            pointBackgroundColor: colorSchemes[colorScheme][0],
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    font: {
                        size: 12,
                        family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                    },
                    padding: 20
                }
            },
            title: {
                display: true,
                text: chartTitle,
                font: {
                    size: 16,
                    weight: 'bold',
                    family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                },
                padding: 20
            },
            tooltip: {
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                titleColor: '#1f2937',
                bodyColor: '#4b5563',
                borderColor: '#e5e7eb',
                borderWidth: 1,
                cornerRadius: 8,
                padding: 12,
                boxPadding: 6,
                callbacks: {
                    label: function (context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== undefined) {
                            label += context.parsed.y.toLocaleString();
                        } else if (context.parsed !== undefined) {
                            label += context.parsed.toLocaleString();
                        }
                        return label;
                    }
                }
            }
        },
        scales: chartType !== 'pie' && chartType !== 'doughnut' ? {
            x: {
                grid: {
                    display: showGrid,
                    drawBorder: false
                },
                ticks: {
                    font: {
                        size: 11,
                        family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                    },
                    maxRotation: 45
                }
            },
            y: {
                beginAtZero: true,
                grid: {
                    display: showGrid,
                    drawBorder: false
                },
                ticks: {
                    font: {
                        size: 11,
                        family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                    },
                    callback: function (value) {
                        if (value >= 1000) {
                            return (value / 1000).toFixed(1) + 'k';
                        }
                        return value;
                    }
                }
            }
        } : undefined
    };

    const stats = getStats();

    return (
        <div className="container-fluid py-4">
            {/* Header */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4">
                <div>
                    <h1 className="fw-bold mb-2">
                        <i className="bi bi-bar-chart-line-fill me-2 text-primary"></i>
                        Chart Builder
                    </h1>
                    <p className="text-muted mb-0">Create beautiful, interactive visualizations from your data</p>
                </div>
                <div className="d-flex gap-2 mt-3 mt-md-0">
                    <button
                        className="btn btn-outline-secondary"
                        onClick={resetChart}
                        disabled={loading}
                    >
                        <i className="bi bi-arrow-clockwise me-2"></i>
                        Reset
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={downloadChart}
                        disabled={!chartData.length}
                    >
                        <i className="bi bi-download me-2"></i>
                        Export Chart
                    </button>
                </div>
            </div>

            {/* Error Alert */}
            {error && (
                <div className="alert alert-danger alert-dismissible fade show mb-4" role="alert">
                    <strong>Error:</strong> {error}
                    <button type="button" className="btn-close" onClick={() => setError(null)}></button>
                </div>
            )}

            {/* Controls Card */}
            <div className="card shadow-sm mb-4 border-0">
                <div className="card-body">
                    <div className="row g-3">
                        {/* Dataset Selection */}
                        <div className="col-lg-3 col-md-6">
                            <label className="form-label fw-medium">
                                <i className="bi bi-database me-2"></i>
                                Dataset
                            </label>
                            <select
                                className="form-select"
                                onChange={e => loadColumns(e.target.value)}
                                value={table}
                                disabled={loading}
                            >
                                <option value="">Select a dataset...</option>
                                {datasets.map(d => (
                                    <option key={d.id} value={d.tableName}>
                                        {d.fileName} ({d.rowCount || 0} rows)
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* X Column */}
                        <div className="col-lg-3 col-md-6">
                            <label className="form-label fw-medium">
                                <i className="bi bi-list-columns me-2"></i>
                                X-Axis (Categories)
                            </label>
                            <select
                                className="form-select"
                                onChange={e => setXCol(e.target.value)}
                                value={xCol}
                                disabled={!columns.length || loading}
                            >
                                <option value="">Select column...</option>
                                {columns.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>

                        {/* Y Column */}
                        <div className="col-lg-3 col-md-6">
                            <label className="form-label fw-medium">
                                <i className="bi bi-graph-up me-2"></i>
                                Y-Axis (Values)
                            </label>
                            <select
                                className="form-select"
                                onChange={e => setYCol(e.target.value)}
                                value={yCol}
                                disabled={!columns.length || loading}
                            >
                                <option value="">Select column...</option>
                                {columns.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>

                        {/* Chart Type */}
                        <div className="col-lg-3 col-md-6">
                            <label className="form-label fw-medium">
                                <i className="bi bi-pie-chart-fill me-2"></i>
                                Chart Type
                            </label>
                            <select
                                className="form-select"
                                onChange={e => setChartType(e.target.value)}
                                value={chartType}
                                disabled={loading}
                            >
                                <option value="bar">Bar Chart</option>
                                <option value="line">Line Chart</option>
                                <option value="pie">Pie Chart</option>
                                <option value="doughnut">Doughnut Chart</option>
                            </select>
                        </div>
                    </div>

                    {/* Advanced Settings */}
                    <div className="accordion mt-4 border rounded" id="advancedSettings">
                        <div className="accordion-item border-0">
                            <h2 className="accordion-header">
                                <button
                                    className="accordion-button collapsed bg-light"
                                    type="button"
                                    data-bs-toggle="collapse"
                                    data-bs-target="#collapseAdvanced"
                                >
                                    <i className="bi bi-gear-fill me-2"></i>
                                    Advanced Settings
                                </button>
                            </h2>
                            <div id="collapseAdvanced" className="accordion-collapse collapse show">
                                <div className="accordion-body pt-3">
                                    <div className="row g-3">
                                        <div className="col-md-4">
                                            <label className="form-label">Chart Title</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={chartTitle}
                                                onChange={e => setChartTitle(e.target.value)}
                                                placeholder="Enter chart title"
                                            />
                                        </div>
                                        <div className="col-md-4">
                                            <label className="form-label">Color Scheme</label>
                                            <select
                                                className="form-select"
                                                value={colorScheme}
                                                onChange={e => setColorScheme(e.target.value)}
                                            >
                                                <option value="gradient">Gradient</option>
                                                <option value="pastel">Pastel</option>
                                                <option value="vibrant">Vibrant</option>
                                                <option value="monochrome">Monochrome</option>
                                            </select>
                                        </div>
                                        <div className="col-md-4">
                                            <label className="form-label">Data Points Limit</label>
                                            <select
                                                className="form-select"
                                                value={dataLimit}
                                                onChange={e => setDataLimit(Number(e.target.value))}
                                            >
                                                <option value={20}>20 points</option>
                                                <option value={50}>50 points</option>
                                                <option value={100}>100 points</option>
                                                <option value={200}>200 points</option>
                                                <option value={0}>All data</option>
                                            </select>
                                        </div>
                                        <div className="col-md-12">
                                            <div className="form-check form-switch">
                                                <input
                                                    className="form-check-input"
                                                    type="checkbox"
                                                    checked={showGrid}
                                                    onChange={e => setShowGrid(e.target.checked)}
                                                    id="gridToggle"
                                                />
                                                <label className="form-check-label" htmlFor="gridToggle">
                                                    Show grid lines
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Generate Button */}
                    <div className="text-center mt-4">
                        <button
                            className="btn btn-success btn-lg px-5"
                            onClick={generateChart}
                            disabled={loading || !table || !xCol || !yCol}
                        >
                            {loading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-magic me-2"></i>
                                    Generate Chart
                                </>
                            )}
                        </button>
                    </div>

                    {/* Dataset Info */}
                    {selectedDatasetInfo && (
                        <div className="alert alert-info mt-3 mb-0">
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <strong>Selected:</strong> {selectedDatasetInfo.fileName}
                                    <span className="ms-3">
                                        <i className="bi bi-table me-1"></i>
                                        {selectedDatasetInfo.rowCount || 0} rows
                                    </span>
                                    <span className="ms-3">
                                        <i className="bi bi-columns me-1"></i>
                                        {columns.length} columns
                                    </span>
                                </div>
                                <small>
                                    Updated: {new Date(selectedDatasetInfo.uploadDate || Date.now()).toLocaleDateString()}
                                </small>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Chart Display Area */}
            {chartData.length > 0 ? (
                <>
                    {/* Stats Cards */}
                    <div className="row mb-4">
                        <div className="col-md-3">
                            <div className="card bg-primary bg-opacity-10 border-primary border-start border-4">
                                <div className="card-body py-3">
                                    <div className="d-flex justify-content-between align-items-center">
                                        <div>
                                            <h6 className="text-muted mb-1">Data Points</h6>
                                            <h4 className="fw-bold mb-0">{chartData.length}</h4>
                                        </div>
                                        <i className="bi bi-list-check fs-4 text-primary"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-3">
                            <div className="card bg-success bg-opacity-10 border-success border-start border-4">
                                <div className="card-body py-3">
                                    <div className="d-flex justify-content-between align-items-center">
                                        <div>
                                            <h6 className="text-muted mb-1">Total Value</h6>
                                            <h4 className="fw-bold mb-0">
                                                {stats?.sum?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || 0}
                                            </h4>
                                        </div>
                                        <i className="bi bi-calculator fs-4 text-success"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-3">
                            <div className="card bg-warning bg-opacity-10 border-warning border-start border-4">
                                <div className="card-body py-3">
                                    <div className="d-flex justify-content-between align-items-center">
                                        <div>
                                            <h6 className="text-muted mb-1">Average</h6>
                                            <h4 className="fw-bold mb-0">
                                                {stats?.avg?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || 0}
                                            </h4>
                                        </div>
                                        <i className="bi bi-bar-chart fs-4 text-warning"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-3">
                            <div className="card bg-info bg-opacity-10 border-info border-start border-4">
                                <div className="card-body py-3">
                                    <div className="d-flex justify-content-between align-items-center">
                                        <div>
                                            <h6 className="text-muted mb-1">Max Value</h6>
                                            <h4 className="fw-bold mb-0">
                                                {stats?.max?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || 0}
                                            </h4>
                                        </div>
                                        <i className="bi bi-arrow-up-right fs-4 text-info"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="row">
                        {/* Main Chart */}
                        <div className="col-lg-8">
                            <div className="card shadow-sm h-100">
                                <div className="card-body">
                                    <div className="d-flex justify-content-between align-items-center mb-3">
                                        <h5 className="card-title mb-0">
                                            <i className="bi bi-graph-up me-2"></i>
                                            {chartTitle}
                                        </h5>
                                        <div className="d-flex gap-2">
                                            <span className="badge bg-primary">
                                                {chartType.toUpperCase()}
                                            </span>
                                            <span className="badge bg-light text-dark">
                                                <i className="bi bi-circle-fill me-1" style={{ color: colorSchemes[colorScheme][0] }}></i>
                                                {colorScheme}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ height: '500px' }}>
                                        {chartType === "bar" && (
                                            <Bar
                                                id="chart-canvas"
                                                data={chartConfig}
                                                options={chartOptions}
                                            />
                                        )}
                                        {chartType === "line" && (
                                            <Line
                                                id="chart-canvas"
                                                data={chartConfig}
                                                options={chartOptions}
                                            />
                                        )}
                                        {chartType === "pie" && (
                                            <Pie
                                                id="chart-canvas"
                                                data={chartConfig}
                                                options={chartOptions}
                                            />
                                        )}
                                        {chartType === "doughnut" && (
                                            <Doughnut
                                                id="chart-canvas"
                                                data={chartConfig}
                                                options={chartOptions}
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Data Preview & Info */}
                        <div className="col-lg-4">
                            <div className="card shadow-sm h-100">
                                <div className="card-header d-flex justify-content-between align-items-center">
                                    <h6 className="mb-0">
                                        <i className="bi bi-table me-2"></i>
                                        Data Preview
                                    </h6>
                                    <span className="badge bg-secondary">
                                        Showing {Math.min(20, chartData.length)}/{chartData.length}
                                    </span>
                                </div>
                                <div className="card-body p-0">
                                    <div className="table-responsive" style={{ maxHeight: '500px' }}>
                                        <table className="table table-hover mb-0">
                                            <thead className="sticky-top bg-light">
                                                <tr>
                                                    <th style={{ width: '50px' }}>#</th>
                                                    <th>{xCol}</th>
                                                    <th className="text-end">{yCol}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {chartData.slice(0, 20).map((item, index) => (
                                                    <tr key={index}>
                                                        <td className="text-muted">{index + 1}</td>
                                                        <td className="text-truncate" style={{ maxWidth: '150px' }} title={item.label || item[xCol] || "N/A"}>
                                                            {item.label || item[xCol] || "N/A"}
                                                        </td>
                                                        <td className="text-end fw-medium">
                                                            {(Number(item.value) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div className="card-footer bg-light">
                                    <small className="text-muted">
                                        <i className="bi bi-info-circle me-1"></i>
                                        Hover over data points for details • Click on legend items to toggle visibility
                                    </small>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                /* Empty State */
                <div className="text-center py-5">
                    <div className="mb-4">
                        <div className="bg-light rounded-circle d-inline-flex p-4 mb-3">
                            <i className="bi bi-bar-chart fs-1 text-muted"></i>
                        </div>
                        <h4 className="fw-medium mb-2">No Chart Generated Yet</h4>
                        <p className="text-muted mb-4">
                            Select a dataset and columns, then click "Generate Chart" to create your visualization
                        </p>
                        <div className="d-flex justify-content-center gap-3">
                            <div className="text-center">
                                <div className="bg-primary bg-opacity-10 rounded-circle p-3 d-inline-block mb-2">
                                    <i className="bi bi-database text-primary fs-4"></i>
                                </div>
                                <p className="small mb-0">1. Select Dataset</p>
                            </div>
                            <div className="text-center">
                                <div className="bg-success bg-opacity-10 rounded-circle p-3 d-inline-block mb-2">
                                    <i className="bi bi-columns text-success fs-4"></i>
                                </div>
                                <p className="small mb-0">2. Choose Columns</p>
                            </div>
                            <div className="text-center">
                                <div className="bg-warning bg-opacity-10 rounded-circle p-3 d-inline-block mb-2">
                                    <i className="bi bi-magic text-warning fs-4"></i>
                                </div>
                                <p className="small mb-0">3. Generate Chart</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="mt-5 pt-4 border-top text-center text-muted small">
                <p>
                    <i className="bi bi-code-slash me-1"></i>
                    Chart Builder v1.0 •
                    <i className="bi bi-cpu ms-3 me-1"></i>
                    Powered by Chart.js •
                    <i className="bi bi-database ms-3 me-1"></i>
                    {datasets.length} datasets available
                </p>
            </div>
        </div>
    );
}
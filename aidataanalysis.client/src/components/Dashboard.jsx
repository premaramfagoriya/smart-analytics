import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import * as htmlToImage from "html-to-image";
import {
    BarChart, Bar,
    LineChart, Line,
    PieChart, Pie,
    AreaChart, Area,
    Tooltip, CartesianGrid,
    XAxis, YAxis,
    ResponsiveContainer, Legend,
    Cell
} from "recharts";

const API = "https://localhost:7130/api/Dataset";

export default function Dashboard() {
    const [datasets, setDatasets] = useState([]);
    const [columns, setColumns] = useState([]);
    const [charts, setCharts] = useState([]);
    const [selectedTable, setSelectedTable] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [stats, setStats] = useState({
        totalRows: 0,
        totalColumns: 0,
        datasetCount: 0
    });

    const [selectedX, setSelectedX] = useState("");
    const [selectedY, setSelectedY] = useState("");
    const [selectedChartType, setSelectedChartType] = useState("bar");

    // Load datasets - useCallback to memoize
    const loadDatasets = useCallback(async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${API}/list`);
            setDatasets(res.data);
            setStats(s => ({ ...s, datasetCount: res.data.length }));
            setError(null);
        } catch (err) {
            setError("Failed to load datasets. Please try again.");
            console.error("Error loading datasets:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Load dashboard data
    const loadDashboardData = useCallback(async (tableName) => {
        if (!tableName) return;

        try {
            setLoading(true);
            setSelectedTable(tableName);
            setError(null);

            // Load insights
            const insightRes = await axios.get(`${API}/insights/${tableName}`);
            setStats(s => ({
                ...s,
                totalRows: insightRes.data.totalRows,
                totalColumns: insightRes.data.totalColumns
            }));

            // Load columns
            const colRes = await axios.get(`${API}/columns/${tableName}`);
            const cols = colRes.data;
            setColumns(cols);

            // Default selections
            if (cols.length >= 2) {
                setSelectedX(cols[0]);
                setSelectedY(cols[1]);
            } else if (cols.length === 1) {
                setSelectedX(cols[0]);
                setSelectedY(cols[0]);
            }

            // Auto generate charts
            await autoGenerateCharts(tableName, cols, insightRes.data.numericAverages);
        } catch (err) {
            setError("Failed to load dashboard data. Please check your connection.");
            console.error("Error loading dashboard data:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Auto generate charts
    const autoGenerateCharts = async (tableName, cols, numericAverages) => {
        try {
            const numericCols = Object.keys(numericAverages || {});
            const categoryCols = cols.filter(c => !numericCols.includes(c));
            const generated = [];

            // Limit the number of charts to prevent overload
            const maxCharts = 6;
            let chartCount = 0;

            for (let num of numericCols.slice(0, 2)) {
                for (let cat of categoryCols.slice(0, 2)) {
                    if (chartCount >= maxCharts) break;

                    const res = await axios.get(`${API}/chart`, {
                        params: {
                            tableName,
                            xColumn: cat,
                            yColumn: num
                        }
                    });

                    if (res.data && res.data.length > 0) {
                        const data = res.data.map(x => ({
                            name: x.label || x[cat] || "Unknown",
                            value: Number(x.value) || 0
                        }));

                        generated.push({
                            title: `${num} by ${cat}`,
                            type: "bar",
                            data
                        });

                        generated.push({
                            title: `${num} Trend by ${cat}`,
                            type: "line",
                            data
                        });

                        chartCount += 2;
                    }
                }
            }

            // Add pie chart if we have limited data
            if (generated.length > 0 && generated[0].data.length <= 10) {
                generated.push({
                    title: `${generated[0].title} Distribution`,
                    type: "pie",
                    data: generated[0].data
                });
            }

            setCharts(generated);
        } catch (err) {
            console.error("Error generating charts:", err);
        }
    };

    // Apply filter
    const applyFilter = async () => {
        if (!selectedTable || !selectedX || !selectedY) return;

        try {
            setLoading(true);
            const res = await axios.get(`${API}/chart`, {
                params: {
                    tableName: selectedTable,
                    xColumn: selectedX,
                    yColumn: selectedY
                }
            });

            const formatted = res.data.map(x => ({
                name: x.label || x[selectedX] || "Unknown",
                value: Number(x.value) || 0
            }));

            setCharts([{
                title: `${selectedY} by ${selectedX}`,
                type: selectedChartType,
                data: formatted
            }]);
        } catch (err) {
            setError("Failed to apply filter. Please check your selections.");
            console.error("Error applying filter:", err);
        } finally {
            setLoading(false);
        }
    };

    // Generate recommendations
    const generateRecommendations = () => {
        if (!columns.length) return [];

        const recommendations = [
            `📊 Compare ${selectedY || "values"} across ${selectedX || "categories"}`,
            `📈 Identify trends over time`,
            `🍩 View data distribution patterns`,
            `🔍 Detect outliers and anomalies`
        ];

        if (columns.length > 2) {
            recommendations.push(`📋 Consider adding ${columns[2]} for deeper insights`);
        }

        return recommendations;
    };

    // Export dashboard
    const exportDashboard = async () => {
        try {
            const node = document.getElementById("dashboard-area");
            if (!node) return;

            const dataUrl = await htmlToImage.toPng(node, {
                backgroundColor: '#ffffff',
                quality: 1.0,
                pixelRatio: 2
            });

            const link = document.createElement("a");
            link.download = `dashboard-${selectedTable || 'export'}-${new Date().toISOString().split('T')[0]}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            setError("Failed to export dashboard. Please try again.");
            console.error("Error exporting dashboard:", err);
        }
    };

    // Render individual chart
    const renderChart = (chart) => {
        if (!chart?.data?.length) {
            return (
                <div className="d-flex align-items-center justify-content-center" style={{ height: 260 }}>
                    <div className="text-center text-muted">
                        <i className="bi bi-graph-up" style={{ fontSize: '48px', opacity: 0.3 }}></i>
                        <p className="mt-2">No data available</p>
                    </div>
                </div>
            );
        }

        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

        return (
            <ResponsiveContainer width="100%" height={260}>
                {chart.type === "bar" && (
                    <BarChart data={chart.data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis
                            dataKey="name"
                            angle={chart.data.length > 6 ? -45 : 0}
                            textAnchor={chart.data.length > 6 ? "end" : "middle"}
                            tick={{ fontSize: 12 }}
                        />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'white',
                                border: '1px solid #e5e7eb',
                                borderRadius: '6px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}
                        />
                        <Legend />
                        <Bar dataKey="value" fill={colors[0]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                )}

                {chart.type === "line" && (
                    <LineChart data={chart.data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis
                            dataKey="name"
                            angle={chart.data.length > 6 ? -45 : 0}
                            textAnchor={chart.data.length > 6 ? "end" : "middle"}
                            tick={{ fontSize: 12 }}
                        />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'white',
                                border: '1px solid #e5e7eb',
                                borderRadius: '6px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}
                        />
                        <Legend />
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke={colors[1]}
                            strokeWidth={2}
                            dot={{ r: 4 }}
                            activeDot={{ r: 6 }}
                        />
                    </LineChart>
                )}

                {chart.type === "pie" && (
                    <PieChart>
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'white',
                                border: '1px solid #e5e7eb',
                                borderRadius: '6px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}
                        />
                        <Legend />
                        <Pie
                            data={chart.data}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={(entry) => `${entry.name}: ${entry.value}`}
                        >
                            {chart.data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                            ))}
                        </Pie>
                    </PieChart>
                )}

                {chart.type === "area" && (
                    <AreaChart data={chart.data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis
                            dataKey="name"
                            angle={chart.data.length > 6 ? -45 : 0}
                            textAnchor={chart.data.length > 6 ? "end" : "middle"}
                            tick={{ fontSize: 12 }}
                        />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'white',
                                border: '1px solid #e5e7eb',
                                borderRadius: '6px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}
                        />
                        <Legend />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke={colors[2]}
                            fill={colors[2]}
                            fillOpacity={0.3}
                        />
                    </AreaChart>
                )}
            </ResponsiveContainer>
        );
    };

    // Initialize on component mount
    useEffect(() => {
        loadDatasets();
    }, [loadDatasets]);

    return (
        <div className="container-fluid py-3">
            {/* Header */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4">
                <div>
                    <h2 className="fw-bold mb-1">📊 Analytics Dashboard</h2>
                    <p className="text-muted mb-0">Interactive data visualization and insights</p>
                </div>
                <button
                    className="btn btn-outline-primary mt-2 mt-md-0"
                    onClick={exportDashboard}
                    disabled={!charts.length}
                >
                    <i className="bi bi-download me-2"></i>
                    Export Dashboard
                </button>
            </div>

            {/* Error Alert */}
            {error && (
                <div className="alert alert-danger alert-dismissible fade show mb-4" role="alert">
                    {error}
                    <button type="button" className="btn-close" onClick={() => setError(null)}></button>
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-2 text-muted">Loading dashboard data...</p>
                </div>
            )}

            {/* Main Content */}
            {!loading && (
                <>
                    {/* Dataset Selector Card */}
                    <div className="card shadow-sm mb-4">
                        <div className="card-body">
                            <h5 className="card-title mb-3">
                                <i className="bi bi-database me-2"></i>
                                Select Dataset
                            </h5>
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <select
                                        className="form-select form-select-lg"
                                        onChange={e => loadDashboardData(e.target.value)}
                                        value={selectedTable}
                                        disabled={loading}
                                    >
                                        <option value="">Choose a dataset...</option>
                                        {datasets.map(d => (
                                            <option key={d.id} value={d.tableName}>
                                                {d.fileName} ({d.rowCount || 0} rows)
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-md-6">
                                    <div className="d-flex align-items-center h-100">
                                        <span className="badge bg-light text-dark me-2">
                                            {stats.datasetCount} datasets available
                                        </span>
                                        <span className="badge bg-light text-dark">
                                            Last updated: {new Date().toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* KPI Cards */}
                    <div className="row g-3 mb-4">
                        <div className="col-md-4">
                            <div className="card shadow-sm border-start border-primary border-3">
                                <div className="card-body">
                                    <div className="d-flex justify-content-between align-items-start">
                                        <div>
                                            <h6 className="text-muted mb-1">Total Rows</h6>
                                            <h2 className="fw-bold">{stats.totalRows.toLocaleString()}</h2>
                                        </div>
                                        <div className="bg-primary bg-opacity-10 p-3 rounded">
                                            <i className="bi bi-table text-primary fs-4"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-4">
                            <div className="card shadow-sm border-start border-success border-3">
                                <div className="card-body">
                                    <div className="d-flex justify-content-between align-items-start">
                                        <div>
                                            <h6 className="text-muted mb-1">Total Columns</h6>
                                            <h2 className="fw-bold">{stats.totalColumns}</h2>
                                        </div>
                                        <div className="bg-success bg-opacity-10 p-3 rounded">
                                            <i className="bi bi-layout-text-window text-success fs-4"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-4">
                            <div className="card shadow-sm border-start border-info border-3">
                                <div className="card-body">
                                    <div className="d-flex justify-content-between align-items-start">
                                        <div>
                                            <h6 className="text-muted mb-1">Datasets</h6>
                                            <h2 className="fw-bold">{stats.datasetCount}</h2>
                                        </div>
                                        <div className="bg-info bg-opacity-10 p-3 rounded">
                                            <i className="bi bi-folder text-info fs-4"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Controls Card */}
                    {selectedTable && (
                        <>
                            <div className="card shadow-sm mb-4">
                                <div className="card-body">
                                    <h5 className="card-title mb-3">
                                        <i className="bi bi-sliders me-2"></i>
                                        Chart Configuration
                                    </h5>
                                    <div className="row g-3">
                                        <div className="col-lg-3 col-md-6">
                                            <label className="form-label fw-medium">X-Axis Column</label>
                                            <select
                                                className="form-select"
                                                value={selectedX}
                                                onChange={e => setSelectedX(e.target.value)}
                                            >
                                                {columns.map(c => (
                                                    <option key={c} value={c}>{c}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-lg-3 col-md-6">
                                            <label className="form-label fw-medium">Y-Axis Column</label>
                                            <select
                                                className="form-select"
                                                value={selectedY}
                                                onChange={e => setSelectedY(e.target.value)}
                                            >
                                                {columns.map(c => (
                                                    <option key={c} value={c}>{c}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-lg-3 col-md-6">
                                            <label className="form-label fw-medium">Chart Type</label>
                                            <select
                                                className="form-select"
                                                value={selectedChartType}
                                                onChange={e => setSelectedChartType(e.target.value)}
                                            >
                                                <option value="bar">Bar Chart</option>
                                                <option value="line">Line Chart</option>
                                                <option value="pie">Pie Chart</option>
                                                <option value="area">Area Chart</option>
                                            </select>
                                        </div>
                                        <div className="col-lg-3 col-md-6 d-flex align-items-end">
                                            <button
                                                className="btn btn-primary w-100"
                                                onClick={applyFilter}
                                                disabled={!selectedX || !selectedY}
                                            >
                                                <i className="bi bi-play-fill me-2"></i>
                                                Generate Chart
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Recommendations Card */}
                            <div className="card shadow-sm mb-4 bg-light border-0">
                                <div className="card-body">
                                    <h5 className="card-title mb-3">
                                        <i className="bi bi-lightbulb me-2"></i>
                                        Smart Recommendations
                                    </h5>
                                    <div className="row">
                                        {generateRecommendations().map((r, i) => (
                                            <div key={i} className="col-md-3 col-sm-6 mb-2">
                                                <div className="d-flex align-items-start">
                                                    <i className="bi bi-check-circle-fill text-success me-2 mt-1"></i>
                                                    <span className="small">{r}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Charts Grid */}
                            <div id="dashboard-area">
                                {charts.length > 0 ? (
                                    <>
                                        <div className="d-flex justify-content-between align-items-center mb-3">
                                            <h5 className="mb-0">
                                                <i className="bi bi-graph-up me-2"></i>
                                                Visualizations ({charts.length})
                                            </h5>
                                            <span className="text-muted small">
                                                Click on any chart to explore details
                                            </span>
                                        </div>
                                        <div className="row g-4">
                                            {charts.map((chart, index) => (
                                                <div key={index} className="col-xl-4 col-lg-6 col-md-12">
                                                    <div className="card shadow-sm h-100 border-hover">
                                                        <div className="card-header bg-white border-bottom-0 pb-0">
                                                            <div className="d-flex justify-content-between align-items-center">
                                                                <h6 className="fw-medium mb-0">{chart.title}</h6>
                                                                <span className="badge bg-light text-dark">
                                                                    {chart.type.toUpperCase()}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="card-body pt-3">
                                                            {renderChart(chart)}
                                                        </div>
                                                        <div className="card-footer bg-white border-top-0 pt-0">
                                                            <div className="small text-muted">
                                                                {chart.data?.length || 0} data points •
                                                                {chart.data?.length > 0 && ` Max: ${Math.max(...chart.data.map(d => d.value))}`}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center py-5">
                                        <i className="bi bi-graph-up" style={{ fontSize: '64px', opacity: 0.2 }}></i>
                                        <h5 className="mt-3 text-muted">No charts generated yet</h5>
                                        <p className="text-muted mb-4">Select columns and click "Generate Chart" to create visualizations</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </>
            )}

            {/* Footer */}
            {!loading && (
                <div className="mt-5 pt-4 border-top text-center text-muted small">
                    <p>Analytics Dashboard • Powered by Recharts • {new Date().getFullYear()}</p>
                </div>
            )}
        </div>
    );
}
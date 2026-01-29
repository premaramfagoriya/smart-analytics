import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import Papa from "papaparse";

const API = "https://smart-analytics-o77v.onrender.com/api/Dataset";

export default function DatasetViewer() {
    const [datasets, setDatasets] = useState([]);
    const [selectedTable, setSelectedTable] = useState("");
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [columns, setColumns] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(50);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [previewData, setPreviewData] = useState(null);

    const ITEMS_PER_PAGE = 50;

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

    const loadTableData = useCallback(async (tableName, datasetInfo) => {
        try {
            setLoading(true);
            setSelectedTable(tableName);
            setCurrentPage(1);
            setSearchTerm("");

            // Set preview data
            if (datasetInfo) {
                setPreviewData({
                    fileName: datasetInfo.fileName,
                    rowCount: datasetInfo.rowCount,
                    uploadDate: datasetInfo.uploadDate,
                    columns: datasetInfo.columns || []
                });
            }

            const res = await axios.get(`${API}/data/${tableName}`, {
                params: { limit: 1000 }
            });

            const data = res.data || [];
            setRows(data);

            // Extract columns from first row if data exists
            if (data.length > 0) {
                const cols = Object.keys(data[0]);
                setColumns(cols);
            } else {
                setColumns([]);
            }

            setError(null);
        } catch (err) {
            setError("Failed to load table data. Please try again.");
            console.error("Error loading table data:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Handle sorting
    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Filter and sort data
    const getFilteredAndSortedData = () => {
        let filtered = rows;

        // Apply search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(row =>
                Object.values(row).some(val =>
                    String(val).toLowerCase().includes(term)
                )
            );
        }

        // Apply sorting
        if (sortConfig.key) {
            filtered = [...filtered].sort((a, b) => {
                const aVal = a[sortConfig.key];
                const bVal = b[sortConfig.key];

                // Handle different data types
                if (typeof aVal === 'number' && typeof bVal === 'number') {
                    return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
                }

                const aStr = String(aVal || '').toLowerCase();
                const bStr = String(bVal || '').toLowerCase();

                if (sortConfig.direction === 'asc') {
                    return aStr.localeCompare(bStr);
                } else {
                    return bStr.localeCompare(aStr);
                }
            });
        }

        return filtered;
    };

    const filteredData = getFilteredAndSortedData();

    // Pagination calculations
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedData = filteredData.slice(startIndex, endIndex);

    // Export functions
    const exportToCSV = () => {
        if (!filteredData.length) return;

        const csv = Papa.unparse(filteredData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${selectedTable || 'dataset'}_${new Date().getTime()}.csv`;
        link.click();
    };

    const exportToJSON = () => {
        if (!filteredData.length) return;

        const json = JSON.stringify(filteredData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${selectedTable || 'dataset'}_${new Date().getTime()}.json`;
        link.click();
    };

    // Get column statistics
    const getColumnStats = (col) => {
        const values = rows.map(row => row[col]).filter(val => val != null);
        if (values.length === 0) return null;

        const numericValues = values.filter(v => !isNaN(parseFloat(v)));
        const isNumeric = numericValues.length > 0;

        if (isNumeric) {
            const nums = numericValues.map(v => parseFloat(v));
            const sum = nums.reduce((a, b) => a + b, 0);
            const avg = sum / nums.length;
            const min = Math.min(...nums);
            const max = Math.max(...nums);

            return {
                type: 'numeric',
                count: values.length,
                unique: new Set(values.map(v => String(v))).size,
                min,
                max,
                avg,
                sum
            };
        } else {
            return {
                type: 'text',
                count: values.length,
                unique: new Set(values.map(v => String(v))).size,
                topValues: Object.entries(
                    values.reduce((acc, val) => {
                        const strVal = String(val);
                        acc[strVal] = (acc[strVal] || 0) + 1;
                        return acc;
                    }, {})
                ).sort((a, b) => b[1] - a[1]).slice(0, 5)
            };
        }
    };

    // Format value for display
    const formatValue = (value) => {
        if (value === null || value === undefined) {
            return <span className="text-muted fst-italic">null</span>;
        }

        if (typeof value === 'number') {
            if (Number.isInteger(value)) {
                return value.toLocaleString();
            }
            return parseFloat(value.toFixed(4)).toLocaleString();
        }

        if (typeof value === 'boolean') {
            return value ? '✓' : '✗';
        }

        const strVal = String(value);
        if (strVal.length > 100) {
            return (
                <span title={strVal}>
                    {strVal.substring(0, 100)}...
                </span>
            );
        }

        return strVal;
    };

    return (
        <div className="container-fluid py-4">
            {/* Header */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4">
                <div>
                    <h1 className="fw-bold mb-2">
                        <i className="bi bi-database-fill me-2 text-primary"></i>
                        Dataset Viewer
                    </h1>
                    <p className="text-muted mb-0">Browse, search, and analyze your uploaded datasets</p>
                </div>
                <div className="d-flex gap-2 mt-3 mt-md-0">
                    <button
                        className="btn btn-outline-secondary"
                        onClick={() => loadDatasets()}
                        disabled={loading}
                    >
                        <i className="bi bi-arrow-clockwise me-2"></i>
                        Refresh
                    </button>
                    {selectedTable && rows.length > 0 && (
                        <div className="dropdown">
                            <button
                                className="btn btn-primary dropdown-toggle"
                                type="button"
                                data-bs-toggle="dropdown"
                            >
                                <i className="bi bi-download me-2"></i>
                                Export
                            </button>
                            <ul className="dropdown-menu">
                                <li>
                                    <button className="dropdown-item" onClick={exportToCSV}>
                                        <i className="bi bi-filetype-csv me-2"></i>
                                        Export as CSV
                                    </button>
                                </li>
                                <li>
                                    <button className="dropdown-item" onClick={exportToJSON}>
                                        <i className="bi bi-filetype-json me-2"></i>
                                        Export as JSON
                                    </button>
                                </li>
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            {/* Error Alert */}
            {error && (
                <div className="alert alert-danger alert-dismissible fade show mb-4" role="alert">
                    <strong>Error:</strong> {error}
                    <button type="button" className="btn-close" onClick={() => setError(null)}></button>
                </div>
            )}

            <div className="row">
                {/* Dataset List Panel */}
                <div className="col-lg-4 col-xl-3 mb-4">
                    <div className="card shadow-sm h-100">
                        <div className="card-header bg-white border-bottom-0">
                            <h5 className="mb-0">
                                <i className="bi bi-folder-fill me-2"></i>
                                Datasets ({datasets.length})
                            </h5>
                        </div>
                        <div className="card-body p-0">
                            {loading ? (
                                <div className="text-center py-5">
                                    <div className="spinner-border text-primary" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                    <p className="mt-2 text-muted">Loading datasets...</p>
                                </div>
                            ) : datasets.length === 0 ? (
                                <div className="text-center py-5">
                                    <i className="bi bi-database text-muted fs-1 mb-3"></i>
                                    <p className="text-muted">No datasets uploaded yet</p>
                                </div>
                            ) : (
                                <div className="list-group list-group-flush">
                                    {datasets.map((dataset) => (
                                        <button
                                            key={dataset.id}
                                            className={`list-group-item list-group-item-action border-0 py-3 ${selectedTable === dataset.tableName ? 'active' : ''}`}
                                            onClick={() => loadTableData(dataset.tableName, dataset)}
                                        >
                                            <div className="d-flex justify-content-between align-items-start">
                                                <div className="d-flex align-items-start">
                                                    <div className={`me-3 ${selectedTable === dataset.tableName ? 'text-white' : 'text-primary'}`}>
                                                        <i className="bi bi-table fs-5"></i>
                                                    </div>
                                                    <div className="text-start">
                                                        <h6 className="mb-1 fw-medium">{dataset.fileName}</h6>
                                                        <small className={`d-block ${selectedTable === dataset.tableName ? 'text-white-50' : 'text-muted'}`}>
                                                            {dataset.tableName}
                                                        </small>
                                                    </div>
                                                </div>
                                                <div className={`badge bg-light text-dark ${selectedTable === dataset.tableName ? 'bg-white text-dark' : ''}`}>
                                                    {dataset.rowCount?.toLocaleString() || '0'} rows
                                                </div>
                                            </div>
                                            <small className={`d-block mt-2 ${selectedTable === dataset.tableName ? 'text-white-50' : 'text-muted'}`}>
                                                <i className="bi bi-calendar me-1"></i>
                                                {new Date(dataset.uploadDate || Date.now()).toLocaleDateString()}
                                            </small>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="card-footer bg-white border-top">
                            <small className="text-muted">
                                <i className="bi bi-info-circle me-1"></i>
                                Click on any dataset to preview its data
                            </small>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="col-lg-8 col-xl-9">
                    {selectedTable ? (
                        <>
                            {/* Dataset Info Header */}
                            <div className="card shadow-sm mb-4">
                                <div className="card-body">
                                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center">
                                        <div>
                                            <h5 className="card-title mb-1">
                                                <i className="bi bi-table me-2"></i>
                                                {previewData?.fileName || selectedTable}
                                            </h5>
                                            <div className="d-flex flex-wrap gap-3 mt-2">
                                                <span className="badge bg-primary">
                                                    <i className="bi bi-table me-1"></i>
                                                    {selectedTable}
                                                </span>
                                                <span className="badge bg-success">
                                                    <i className="bi bi-list-columns me-1"></i>
                                                    {columns.length} columns
                                                </span>
                                                <span className="badge bg-info">
                                                    <i className="bi bi-list-ul me-1"></i>
                                                    {rows.length.toLocaleString()} rows
                                                </span>
                                                {previewData?.uploadDate && (
                                                    <span className="badge bg-secondary">
                                                        <i className="bi bi-calendar me-1"></i>
                                                        Uploaded: {new Date(previewData.uploadDate).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="mt-3 mt-md-0">
                                            <div className="input-group" style={{ minWidth: '300px' }}>
                                                <span className="input-group-text">
                                                    <i className="bi bi-search"></i>
                                                </span>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="Search in dataset..."
                                                    value={searchTerm}
                                                    onChange={(e) => {
                                                        setSearchTerm(e.target.value);
                                                        setCurrentPage(1);
                                                    }}
                                                />
                                                {searchTerm && (
                                                    <button
                                                        className="btn btn-outline-secondary"
                                                        onClick={() => setSearchTerm("")}
                                                    >
                                                        <i className="bi bi-x"></i>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Column Statistics */}
                            <div className="row mb-4">
                                {columns.slice(0, 4).map(col => {
                                    const stats = getColumnStats(col);
                                    return stats ? (
                                        <div key={col} className="col-md-3 col-sm-6 mb-3">
                                            <div className="card h-100 border">
                                                <div className="card-body py-3">
                                                    <h6 className="card-subtitle mb-2 text-truncate" title={col}>
                                                        {col}
                                                    </h6>
                                                    <div className="d-flex justify-content-between align-items-center">
                                                        <div>
                                                            <small className="text-muted d-block">
                                                                {stats.type === 'numeric' ? (
                                                                    <>
                                                                        <span className="me-2">Avg: {stats.avg.toFixed(2)}</span>
                                                                        <span>Min/Max: {stats.min}/{stats.max}</span>
                                                                    </>
                                                                ) : (
                                                                    <>{stats.unique} unique values</>
                                                                )}
                                                            </small>
                                                        </div>
                                                        <span className={`badge ${stats.type === 'numeric' ? 'bg-primary' : 'bg-secondary'}`}>
                                                            {stats.type}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : null;
                                })}
                            </div>

                            {/* Data Table */}
                            <div className="card shadow-sm">
                                <div className="card-header bg-white d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center py-3">
                                    <h6 className="mb-2 mb-md-0">
                                        <i className="bi bi-table me-2"></i>
                                        Data Preview
                                        <span className="badge bg-light text-dark ms-2">
                                            Showing {paginatedData.length} of {filteredData.length.toLocaleString()} records
                                            {searchTerm && ` (filtered)`}
                                        </span>
                                    </h6>

                                    <div className="d-flex align-items-center">
                                        <div className="input-group input-group-sm me-3" style={{ width: '150px' }}>
                                            <span className="input-group-text">
                                                <i className="bi bi-list-ul"></i>
                                            </span>
                                            <select
                                                className="form-select"
                                                value={rowsPerPage}
                                                onChange={(e) => {
                                                    setRowsPerPage(parseInt(e.target.value));
                                                    setCurrentPage(1);
                                                }}
                                            >
                                                <option value={10}>10 rows</option>
                                                <option value={25}>25 rows</option>
                                                <option value={50}>50 rows</option>
                                                <option value={100}>100 rows</option>
                                                <option value={200}>200 rows</option>
                                            </select>
                                        </div>

                                        <div className="btn-group">
                                            <button
                                                className="btn btn-outline-secondary btn-sm"
                                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                disabled={currentPage === 1}
                                            >
                                                <i className="bi bi-chevron-left"></i>
                                            </button>
                                            <button className="btn btn-outline-secondary btn-sm disabled">
                                                Page {currentPage} of {totalPages}
                                            </button>
                                            <button
                                                className="btn btn-outline-secondary btn-sm"
                                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                disabled={currentPage === totalPages}
                                            >
                                                <i className="bi bi-chevron-right"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="card-body p-0">
                                    {loading ? (
                                        <div className="text-center py-5">
                                            <div className="spinner-border text-primary" role="status">
                                                <span className="visually-hidden">Loading...</span>
                                            </div>
                                            <p className="mt-2 text-muted">Loading data...</p>
                                        </div>
                                    ) : paginatedData.length === 0 ? (
                                        <div className="text-center py-5">
                                            <i className="bi bi-search text-muted fs-1 mb-3"></i>
                                            <p className="text-muted">No data found{matchMedia && " for your search"}</p>
                                            {searchTerm && (
                                                <button
                                                    className="btn btn-outline-primary btn-sm"
                                                    onClick={() => setSearchTerm("")}
                                                >
                                                    Clear search
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="table-responsive" style={{ maxHeight: '600px' }}>
                                            <table className="table table-hover mb-0">
                                                <thead className="sticky-top bg-light">
                                                    <tr>
                                                        <th style={{ width: '50px' }}>#</th>
                                                        {columns.map(col => (
                                                            <th
                                                                key={col}
                                                                style={{ cursor: 'pointer', minWidth: '150px' }}
                                                                onClick={() => handleSort(col)}
                                                                title={`Click to sort by ${col}`}
                                                            >
                                                                <div className="d-flex justify-content-between align-items-center">
                                                                    <span className="text-truncate">{col}</span>
                                                                    <div>
                                                                        {sortConfig.key === col && (
                                                                            <i className={`bi bi-chevron-${sortConfig.direction === 'asc' ? 'up' : 'down'}`}></i>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {paginatedData.map((row, rowIndex) => (
                                                        <tr key={rowIndex}>
                                                            <td className="text-muted fw-medium">
                                                                {startIndex + rowIndex + 1}
                                                            </td>
                                                            {columns.map(col => (
                                                                <td
                                                                    key={col}
                                                                    className={typeof row[col] === 'number' ? 'text-end' : ''}
                                                                    style={{
                                                                        maxWidth: '300px',
                                                                        overflow: 'hidden',
                                                                        textOverflow: 'ellipsis',
                                                                        whiteSpace: 'nowrap'
                                                                    }}
                                                                    title={String(row[col] || '')}
                                                                >
                                                                    {formatValue(row[col])}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                {/* Table Footer */}
                                {paginatedData.length > 0 && (
                                    <div className="card-footer bg-white d-flex justify-content-between align-items-center py-2">
                                        <small className="text-muted">
                                            Showing {startIndex + 1} to {Math.min(endIndex, filteredData.length)} of {filteredData.length.toLocaleString()} entries
                                            {searchTerm && ` (filtered from ${rows.length.toLocaleString()} total)`}
                                        </small>
                                        <div className="d-flex align-items-center">
                                            <small className="text-muted me-3">
                                                Navigate:
                                            </small>
                                            <nav>
                                                <ul className="pagination pagination-sm mb-0">
                                                    <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                                                        <button
                                                            className="page-link"
                                                            onClick={() => setCurrentPage(1)}
                                                        >
                                                            <i className="bi bi-chevron-double-left"></i>
                                                        </button>
                                                    </li>
                                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                                        let pageNum;
                                                        if (totalPages <= 5) {
                                                            pageNum = i + 1;
                                                        } else if (currentPage <= 3) {
                                                            pageNum = i + 1;
                                                        } else if (currentPage >= totalPages - 2) {
                                                            pageNum = totalPages - 4 + i;
                                                        } else {
                                                            pageNum = currentPage - 2 + i;
                                                        }

                                                        return (
                                                            <li
                                                                key={pageNum}
                                                                className={`page-item ${currentPage === pageNum ? 'active' : ''}`}
                                                            >
                                                                <button
                                                                    className="page-link"
                                                                    onClick={() => setCurrentPage(pageNum)}
                                                                >
                                                                    {pageNum}
                                                                </button>
                                                            </li>
                                                        );
                                                    })}
                                                    <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                                                        <button
                                                            className="page-link"
                                                            onClick={() => setCurrentPage(totalPages)}
                                                        >
                                                            <i className="bi bi-chevron-double-right"></i>
                                                        </button>
                                                    </li>
                                                </ul>
                                            </nav>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        /* Empty State */
                        <div className="text-center py-5">
                            <div className="mb-4">
                                <div className="bg-light rounded-circle d-inline-flex p-4 mb-3">
                                    <i className="bi bi-table fs-1 text-muted"></i>
                                </div>
                                <h4 className="fw-medium mb-2">Select a Dataset</h4>
                                <p className="text-muted mb-4">
                                    Choose a dataset from the left panel to view its contents
                                </p>
                                <div className="d-flex justify-content-center gap-3">
                                    <div className="text-center">
                                        <div className="bg-primary bg-opacity-10 rounded-circle p-3 d-inline-block mb-2">
                                            <i className="bi bi-search text-primary fs-4"></i>
                                        </div>
                                        <p className="small mb-0">Search Data</p>
                                    </div>
                                    <div className="text-center">
                                        <div className="bg-success bg-opacity-10 rounded-circle p-3 d-inline-block mb-2">
                                            <i className="bi bi-sort-alpha-down text-success fs-4"></i>
                                        </div>
                                        <p className="small mb-0">Sort Columns</p>
                                    </div>
                                    <div className="text-center">
                                        <div className="bg-warning bg-opacity-10 rounded-circle p-3 d-inline-block mb-2">
                                            <i className="bi bi-download text-warning fs-4"></i>
                                        </div>
                                        <p className="small mb-0">Export Data</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="mt-5 pt-4 border-top text-center text-muted small">
                <p>
                    <i className="bi bi-database me-1"></i>
                    Dataset Viewer • {datasets.length} datasets •
                    <i className="bi bi-cpu ms-3 me-1"></i>
                    {rows.length.toLocaleString()} total rows loaded •
                    <i className="bi bi-clock ms-3 me-1"></i>
                    Last updated: {new Date().toLocaleTimeString()}
                </p>
            </div>
        </div>
    );
}
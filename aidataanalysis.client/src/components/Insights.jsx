import { useEffect, useState } from "react";
import axios from "axios";

const API = "https://localhost:7130/api/Dataset";

export default function Insights() {
    const [datasets, setDatasets] = useState([]);
    const [selected, setSelected] = useState("");
    const [insights, setInsights] = useState(null);

    useEffect(() => {
        loadDatasets();
    }, []);

    const loadDatasets = async () => {
        const res = await axios.get(`${API}/list`);
        setDatasets(res.data);
    };

    const loadInsights = async (tableName) => {
        setSelected(tableName);
        const res = await axios.get(`${API}/insights/${tableName}`);
        setInsights(res.data);
    };

    return (
        <div className="container mt-5">
            <h3>🤖 Auto Insights</h3>

            <select
                className="form-select mb-3"
                onChange={(e) => loadInsights(e.target.value)}
            >
                <option value="">Select Dataset</option>
                {datasets.map(d => (
                    <option key={d.id} value={d.tableName}>
                        {d.fileName}
                    </option>
                ))}
            </select>

            {insights && (
                <div className="row g-3">

                    <div className="col-md-3">
                        <div className="card p-3 shadow">
                            <h6>Total Rows</h6>
                            <h3>{insights.totalRows}</h3>
                        </div>
                    </div>

                    <div className="col-md-3">
                        <div className="card p-3 shadow">
                            <h6>Total Columns</h6>
                            <h3>{insights.totalColumns}</h3>
                        </div>
                    </div>

                    <div className="col-md-6">
                        <div className="card p-3 shadow">
                            <h6>Numeric Averages</h6>
                            <ul>
                                {Object.entries(insights.numericAverages).map(([key, val]) => (
                                    <li key={key}>{key}: {val}</li>
                                ))}
                            </ul>
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
}

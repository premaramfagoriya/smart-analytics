import { useState } from "react";
import axios from "axios";

const API_URL = "https://localhost:7130/api/Dataset/upload";

export default function FileUpload() {
    const [file, setFile] = useState(null);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const uploadFile = async () => {
        if (!file) {
            alert("Please select a file");
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        try {
            setLoading(true);
            const res = await axios.post(API_URL, formData);
            setMessage(`✅ Uploaded successfully! Table: ${res.data.tableName}`);
        } catch (err) {
            console.error(err);
            alert("Upload failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mt-5">
            <div className="card p-4 shadow">
                <h3>📂 Upload Dataset</h3>

                <input
                    type="file"
                    className="form-control mt-3"
                    accept=".csv,.xlsx"
                    onChange={(e) => setFile(e.target.files[0])}
                />

                <button
                    onClick={uploadFile}
                    className="btn btn-primary mt-3"
                    disabled={loading}
                >
                    {loading ? "Uploading..." : "Upload"}
                </button>

                {message && (
                    <div className="alert alert-success mt-3">{message}</div>
                )}
            </div>
        </div>
    );
}

import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./components/Dashboard";
import FileUpload from "./components/FileUpload";
import DatasetViewer from "./components/DatasetViewer";
import ChartBuilder from "./components/ChartBuilder";
import Insights from "./components/Insights";

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="upload" element={<FileUpload />} />
                    <Route path="datasets" element={<DatasetViewer />} />
                    <Route path="charts" element={<ChartBuilder />} />
                    <Route path="insights" element={<Insights />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

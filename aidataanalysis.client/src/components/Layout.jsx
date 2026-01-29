// src/components/Layout.jsx
import { NavLink, Outlet } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";

export default function Layout() {
    return (
        <>
            {/* Top Navbar */}
            <nav className="navbar navbar-expand-lg navbar-dark bg-dark px-4">
                <span className="navbar-brand fw-bold">
                    📊 Smart Analytics Dashboard
                </span>

                <div className="navbar-nav ms-4 gap-2">

                    {/* Dashboard */}
                    <NavLink
                        to="/"
                        end
                        className={({ isActive }) =>
                            isActive ? "nav-link active fw-semibold" : "nav-link"
                        }
                    >
                        Dashboard
                    </NavLink>

                    {/* Upload */}
                    <NavLink
                        to="/upload"
                        className={({ isActive }) =>
                            isActive ? "nav-link active fw-semibold" : "nav-link"
                        }
                    >
                        Upload
                    </NavLink>

                    {/* Datasets */}
                    <NavLink
                        to="/datasets"
                        className={({ isActive }) =>
                            isActive ? "nav-link active fw-semibold" : "nav-link"
                        }
                    >
                        Datasets
                    </NavLink>

                    {/* Charts */}
                    <NavLink
                        to="/charts"
                        className={({ isActive }) =>
                            isActive ? "nav-link active fw-semibold" : "nav-link"
                        }
                    >
                        Charts
                    </NavLink>

                    {/* Insights */}
                    <NavLink
                        to="/insights"
                        className={({ isActive }) =>
                            isActive ? "nav-link active fw-semibold" : "nav-link"
                        }
                    >
                        Insights
                    </NavLink>
                </div>
            </nav>

            {/* Page Content */}
            <main className="container-fluid mt-4 px-4">
                <Outlet />
            </main>
        </>
    );
}

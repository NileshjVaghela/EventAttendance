import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CheckinPage } from "./pages/CheckinPage";
import { SessionPage } from "./pages/SessionPage";
import { AdminLogin } from "./pages/AdminLogin";
import { AdminDashboard } from "./pages/AdminDashboard";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Public attendee routes */}
        <Route path="/checkin" element={<CheckinPage />} />
        <Route path="/session" element={<SessionPage />} />
        {/* Admin routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/*" element={<AdminDashboard />} />
        {/* Default */}
        <Route path="/" element={<CheckinPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

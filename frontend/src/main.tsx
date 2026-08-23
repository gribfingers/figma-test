import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./styles.css";
import { App } from "./App";
import { Dashboard } from "./pages/Dashboard";
import { NewFlight } from "./pages/NewFlight";
import { CheckIn } from "./pages/CheckIn";
import { Boarding } from "./pages/Boarding";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Dashboard />} />
          <Route path="flights/new" element={<NewFlight />} />
          <Route path="checkin/:flightId" element={<CheckIn />} />
          <Route path="boarding/:flightId" element={<Boarding />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

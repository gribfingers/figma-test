import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./styles.css";
import { App } from "./App";
import { TabsProvider } from "./tabs";
import { AuthProvider, RequireAuth } from "./auth";
import { ToastProvider } from "./toast";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { NewFlight } from "./pages/NewFlight";
import { FlightCard } from "./pages/FlightCard";
import { CheckIn } from "./pages/CheckIn";
import { Boarding } from "./pages/Boarding";
import { UserAdmin } from "./pages/UserAdmin";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <TabsProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<RequireAuth />}>
                <Route path="/" element={<App />}>
                  <Route index element={<Dashboard />} />
                  <Route path="flights/new" element={<NewFlight />} />
                  <Route path="flights/:flightId" element={<FlightCard />} />
                  <Route path="checkin/:flightId" element={<CheckIn />} />
                  <Route path="boarding/:flightId" element={<Boarding />} />
                  <Route path="users-admin" element={<UserAdmin />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Route>
            </Routes>
          </TabsProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./styles.css";
import { App } from "./App";
import { TabsProvider } from "./tabs";
import { AuthProvider, RequireAuth } from "./auth";
import { ToastProvider } from "./toast";
import { ConfirmProvider } from "./confirmDialog";
import { ThemeProvider } from "./theme";
import { FontSizeProvider } from "./fontSize";
import { TabIconsProvider } from "./tabIcons";
import { DesktopNotificationsProvider } from "./desktopNotifications";
import { ShortcutsProvider } from "./useShortcuts";
import { LanguageProvider } from "./i18n";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Search } from "./pages/Search";
import { BoardingSearch } from "./pages/BoardingSearch";
import { PnrView } from "./pages/PnrView";
import { NewFlight } from "./pages/NewFlight";
import { FlightCard } from "./pages/FlightCard";
import { CheckIn } from "./pages/CheckIn";
import { Boarding } from "./pages/Boarding";
import { BoardingPax } from "./pages/BoardingPax";
import { UserAdmin } from "./pages/UserAdmin";
import { Analytics } from "./pages/Analytics";
import { EmptyState } from "./pages/EmptyState";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <ThemeProvider>
          <FontSizeProvider>
            <TabIconsProvider>
              <ShortcutsProvider>
                <ToastProvider>
                  <ConfirmProvider>
                    <DesktopNotificationsProvider>
                      <AuthProvider>
                        <TabsProvider>
                          <Routes>
                            <Route path="/login" element={<Login />} />
                            <Route element={<RequireAuth />}>
                              <Route path="/" element={<App />}>
                                <Route index element={<Dashboard />} />
                                <Route path="search" element={<Search />} />
                                <Route path="boarding-search" element={<BoardingSearch />} />
                                <Route path="checkin/:flightId/pnr/:passengerId" element={<PnrView />} />
                                <Route path="flights/new" element={<NewFlight />} />
                                <Route path="flights/:flightId" element={<FlightCard />} />
                                <Route path="checkin/:flightId" element={<CheckIn />} />
                                <Route path="boarding/:flightId" element={<Boarding />} />
                                <Route path="boarding/:flightId/pax/:passengerId" element={<BoardingPax />} />
                                <Route path="users-admin" element={<UserAdmin />} />
                                <Route path="analytics" element={<Analytics />} />
                                <Route path="empty" element={<EmptyState />} />
                                <Route path="*" element={<Navigate to="/" replace />} />
                              </Route>
                            </Route>
                          </Routes>
                        </TabsProvider>
                      </AuthProvider>
                    </DesktopNotificationsProvider>
                  </ConfirmProvider>
                </ToastProvider>
              </ShortcutsProvider>
            </TabIconsProvider>
          </FontSizeProvider>
        </ThemeProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>
);

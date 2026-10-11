import React from "react";
import {createRoot} from "react-dom/client";
import {BrowserRouter,Routes,Route,Navigate} from "react-router-dom";
import "../base.css";
import {GlobalContextProviders} from "../components/_globalContextProviders";
import {UserRoute,AdminRoute} from "../components/ProtectedRoute";
import {FlootRealtimeProvider} from "../components/FlootRealtimeProvider";
import HomePage from "../pages/_index";
import LoginPage from "../pages/login";
import MembershipPage from "../pages/membership";
import WorkstationPage from "../pages/workstation";
import AdminPage from "../pages/admin";

function WorkstationRoute(){
  return <UserRoute><FlootRealtimeProvider><WorkstationPage/></FlootRealtimeProvider></UserRoute>;
}
function AdminProtectedRoute(){
  return <AdminRoute><AdminPage/></AdminRoute>;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <GlobalContextProviders>
        <Routes>
          <Route path="/" element={<HomePage/>}/>
          <Route path="/login" element={<LoginPage/>}/>
          <Route path="/membership" element={<MembershipPage/>}/>
          <Route path="/workstation" element={<WorkstationRoute/>}/>
          <Route path="/admin" element={<AdminProtectedRoute/>}/>
          <Route path="*" element={<Navigate to="/" replace/>}/>
        </Routes>
      </GlobalContextProviders>
    </BrowserRouter>
  </React.StrictMode>
);

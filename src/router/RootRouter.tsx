import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import App from "../App";
import LoginPortal from "../portal/Login";
import TermsPortal from "../portal/Terms";
import StatusPortal from "../portal/Status";
import ControllerConfig from "../components/ControllerConfig";
import { Toaster } from "../components/ui/sonner";

function CatchAllRedirect() {
  const loc = useLocation();
  const search = loc.search || "";
  return <Navigate to={`/portal/login${search}`} replace />;
}

export default function RootRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/admin/controllers/:id/config" element={<ControllerConfig />} />
        <Route path="/admin/*" element={<App />} />
        <Route path="/portal/login" element={<LoginPortal />} />
        <Route path="/portal/terms" element={<TermsPortal />} />
        <Route path="/portal/status" element={<StatusPortal />} />
        {/* Novo: rota de preview acessível da página pós-login */}
        <Route path="/portal/status-preview" element={<StatusPortal />} />
        {/* Catch-all para qualquer caminho interceptado (ex.: /generate_204) */}
        <Route path="*" element={<CatchAllRedirect />} />
      </Routes>
      {/* Global toaster for notifications */}
      <Toaster position="top-right" richColors />
    </BrowserRouter>
  );
}
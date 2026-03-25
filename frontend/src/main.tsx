import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import RenewalRiskPage from "./pages/RenewalRiskPage";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route
          path="/properties/:propertyId/renewal-risk"
          element={<RenewalRiskPage />}
        />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);

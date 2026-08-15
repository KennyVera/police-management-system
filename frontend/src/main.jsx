import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./auth/AuthContext.jsx";
import { BrandingProvider } from "./shared/branding/BrandingContext.jsx";
import { ThemeProvider } from "./shared/theme/ThemeContext.jsx";
import { ConfirmProvider } from "./shared/components/ConfirmContext.jsx";
import "./index.css";
import "./shared/theme/theme.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <BrandingProvider>
          <ConfirmProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </ConfirmProvider>
        </BrandingProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);

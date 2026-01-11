import React, { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";

import MainLayout from "./components/layout/MainLayout";
import Index from "./pages/Index";
import Marketplace from "./pages/Marketplace";
import MyNFTs from "./pages/MyNFTs";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";

/**
 * Query client (keep default settings for now; you can tune cache/timeouts later)
 */
const queryClient = new QueryClient();

/**
 * PageAttributeSetter
 * — sets a data-page attribute on the root <html> element so your
 *   [data-page="..."] CSS selectors will apply automatically.
 */
const PageAttributeSetter: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();

  useEffect(() => {
    // normalize pathname to a simple token used in your CSS, e.g. "/", "/marketplace" -> "marketplace"
    const token =
      location.pathname === "/" ? "index" : location.pathname.replace(/^\//, "").replace(/\//g, "-") || "index";
    // set on <html> so selectors like [data-page="index"] work in your css
    document.documentElement.setAttribute("data-page", token);
  }, [location]);

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <PageAttributeSetter>
          <PageAttributeSetter>
            <MainLayout>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/marketplace" element={<Marketplace />} />
                <Route path="/my-nfts" element={<MyNFTs />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </MainLayout>
          </PageAttributeSetter>
        </PageAttributeSetter>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;

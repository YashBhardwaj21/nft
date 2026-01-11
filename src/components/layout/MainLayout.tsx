import { ReactNode } from "react";
import Navigation from "./Navigation";
import Footer from "./Footer";

interface MainLayoutProps {
    children: ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
    return (
        <div className="min-h-screen bg-background flex flex-col font-sans selection:bg-primary/30 text-foreground">
            <div className="fixed inset-0 z-[-1] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-background to-background pointer-events-none" />

            <Navigation />

            <main className="flex-grow container-wide py-8 fade-in">
                {children}
            </main>

            <Footer />
        </div>
    );
};

export default MainLayout;

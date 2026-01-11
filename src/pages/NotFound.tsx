import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4">
      <div className="relative mb-8">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-primary/20 blur-3xl rounded-full" />
        <h1 className="text-9xl font-bold font-heading text-transparent bg-clip-text bg-gradient-to-b from-white to-white/10 relative z-10">404</h1>
      </div>

      <h2 className="text-2xl font-bold mb-4">Page Not Found</h2>
      <p className="text-muted-foreground max-w-md mb-8">
        The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
      </p>

      <Button asChild variant="premium">
        <Link to="/">
          <ArrowLeft className="mr-2 w-4 h-4" />
          Return to Home
        </Link>
      </Button>
    </div>
  );
};

export default NotFound;

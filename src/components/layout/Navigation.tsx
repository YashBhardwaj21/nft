import { Link, useLocation } from "react-router-dom";
import {
  Wallet,
  Search,
  User,
  LayoutGrid,
  Sparkles
} from "lucide-react";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { cn } from "@/lib/utils";

const Navigation = () => {
  const location = useLocation();

  const navItems = [
    { name: "Discover", href: "/", icon: Sparkles },
    { name: "Marketplace", href: "/marketplace", icon: LayoutGrid },
    { name: "My Dashboard", href: "/my-nfts", icon: User },
  ];

  const isActive = (path: string) =>
    path === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(path);

  return (
    <nav className="sticky top-0 z-50 w-full bg-background/60 backdrop-blur-xl border-b border-white/5">
      <div className="container-wide">
        <div className="flex items-center justify-between h-20">

          {/* Logo Area */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary via-blue-500 to-purple-600 p-[1px] group-hover:scale-105 transition-transform duration-300">
              <div className="w-full h-full rounded-[11px] bg-black/90 flex items-center justify-center">
                <div className="w-4 h-4 rounded-sm bg-gradient-to-br from-primary to-blue-500" />
              </div>
            </div>
            <span className="text-xl font-bold font-heading bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent group-hover:to-primary transition-all duration-300">
              RentableNFT
            </span>
          </Link>

          {/* Center Navigation */}
          <div className="flex items-center gap-1 bg-white/5 p-1.5 rounded-full border border-white/5 backdrop-blur-md">
            {navItems.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center space-x-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300",
                  isActive(item.href)
                    ? "bg-primary/20 text-primary shadow-lg shadow-primary/10 border border-primary/20"
                    : "text-muted-foreground hover:text-white hover:bg-white/5"
                )}
              >
                <item.icon className={cn("w-4 h-4", isActive(item.href) && "animate-pulse")} />
                <span>{item.name}</span>
              </Link>
            ))}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">

            {/* Search Bar - Expanded */}
            <div className="relative group w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 group-hover:text-primary transition-colors" />
              <Input
                placeholder="Search collections..."
                className="pl-10 bg-white/5 border-white/10 focus:bg-black/40 focus:w-72 transition-all duration-300"
              />
            </div>

            <div className="h-8 w-px bg-white/10 mx-2" />

            <Button variant="premium" className="shadow-lg shadow-primary/20">
              <Wallet className="w-4 h-4 mr-2" />
              Connect Wallet
            </Button>
          </div>

        </div>
      </div>
    </nav>
  );
};

export default Navigation;

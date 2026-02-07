
import { useState, useEffect } from "react";
import { ArrowUpDown, Flame, Grid2X2, Search, Sparkles } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import NFTCard from "../components/ui/nft-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Badge } from "@/components/ui/badge";
import api from "../api/client";
import { NFT } from "../types";
import { toast } from "sonner";

const Marketplace = () => {
  const [trendingNfts, setTrendingNfts] = useState<NFT[]>([]);
  const [newArrivals, setNewArrivals] = useState<NFT[]>([]);
  const [allNfts, setAllNfts] = useState<NFT[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search/Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("trending");
  const categories = ["All", "Art", "Gaming", "Photography", "Music", "Virtual Worlds"];
  const [activeCategory, setActiveCategory] = useState("All");

  useEffect(() => {
    fetchAllSections();
  }, []);

  useEffect(() => {
    fetchBrowseResults();
  }, [searchTerm, sortBy, activeCategory]);

  const fetchAllSections = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchTrending(),
        fetchNewArrivals(),
        fetchBrowseResults()
      ]);
    } catch (error) {
      console.error("Error loading marketplace:", error);
      toast.error("Failed to load marketplace content");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTrending = async () => {
    try {
      const response = await api.get(`/marketplace/listings?sortBy=trending&limit=4`);
      setTrendingNfts(mapResponseToNFTs(response.data.data));
    } catch (e) { console.error("Failed to fetch trending", e); }
  };

  const fetchNewArrivals = async () => {
    try {
      const response = await api.get(`/marketplace/listings?sortBy=recent&limit=4`);
      setNewArrivals(mapResponseToNFTs(response.data.data));
    } catch (e) { console.error("Failed to fetch new arrivals", e); }
  };

  const fetchBrowseResults = async () => {
    try {
      let queryParams = new URLSearchParams();
      if (searchTerm) queryParams.append("query", searchTerm);
      if (sortBy) queryParams.append("sortBy", sortBy);
      if (activeCategory !== "All") queryParams.append("category", activeCategory);

      const response = await api.get(`/marketplace/listings?${queryParams.toString()}`);
      setAllNfts(mapResponseToNFTs(response.data.data));
    } catch (e) {
      console.error("Failed to fetch browse results", e);
    }
  };

  const mapResponseToNFTs = (data: any[]): NFT[] => {
    if (!Array.isArray(data)) return [];
    return data.map((item: any) => ({
      ...item.nft,
      id: item.nft.id,
      price: item.price,
      rentalPrice: item.rentalPrice || item.nft.rentalPrice,
      status: item.status === 'sold' ? 'rented' : 'available'
    }));
  };

  return (
    <div className="space-y-12 pb-20 min-h-screen bg-black text-white">

      {/* Header Section */}
      <div
        className="relative w-full md:w-2/3 mx-auto mt-12 rounded-[3rem] py-24 px-6 md:px-12 overflow-hidden border border-white/10"
        style={{
          backgroundImage: "url('/pic2.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-gray-900/95 via-gray-900/70 to-black/30 z-0" />
        <div className="relative z-10 max-w-2xl">
          <Badge className="mb-4 bg-pink-500/20 text-pink-400 border-pink-500/30 backdrop-blur-md px-4 py-1.5 text-sm">Marketplace</Badge>
          <h1 className="text-5xl font-bold font-heading mb-4 leading-tight text-white drop-shadow-lg">
            Discover Exclusive <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 animate-gradient-x">Digital Assets</span>
          </h1>
          <p className="text-xl text-blue-100 font-medium max-w-lg leading-relaxed drop-shadow-md">
            Rent premium NFTs for utility, gaming, and art.
          </p>
        </div>
      </div>

      {/* Navigation Strip */}
      <div className="max-w-7xl mx-auto px-6 py-12 space-y-20">

        {/* Navigation Strip */}
        <div className="flex justify-center gap-4 md:gap-8 border-b border-white/10 pb-6 overflow-x-auto">
          <button
            onClick={() => {
              setSearchTerm("");
              setActiveCategory("All");
              document.getElementById('trending')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="text-base md:text-lg font-medium text-gray-400 hover:text-white hover:bg-white/5 px-6 py-2 rounded-full transition-all whitespace-nowrap"
          >
            Trending
          </button>
          <button
            onClick={() => {
              setSearchTerm("");
              setActiveCategory("All");
              document.getElementById('new-arrivals')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="text-base md:text-lg font-medium text-gray-400 hover:text-white hover:bg-white/5 px-6 py-2 rounded-full transition-all whitespace-nowrap"
          >
            New Arrivals
          </button>
          <button
            onClick={() => document.getElementById('browse')?.scrollIntoView({ behavior: 'smooth' })}
            className="text-base md:text-lg font-medium text-gray-400 hover:text-white hover:bg-white/5 px-6 py-2 rounded-full transition-all whitespace-nowrap"
          >
            Browse Collection
          </button>
        </div>

        {/* Trending Section */}
        {!searchTerm && activeCategory === 'All' && (
          <section id="trending" className="scroll-mt-24">
            <div className="flex items-center justify-between mb-8 ps-2 border-l-4 border-orange-500 pl-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <Flame className="w-6 h-6 text-orange-500" />
                </div>
                <h2 className="text-3xl font-bold text-white tracking-tight">Trending Now</h2>
              </div>
              <Button variant="link" className="text-cyan-400 hover:text-cyan-300">View All</Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {trendingNfts.map(nft => (
                <NFTCard key={nft.id} nft={nft} status={nft.status === 'rented' ? 'rented' : 'listing'} />
              ))}
              {!isLoading && trendingNfts.length === 0 && (
                <div className="col-span-full py-12 text-center bg-zinc-900/50 rounded-2xl border border-white/5">
                  <p className="text-gray-400 text-lg">No trending items yet.</p>
                </div>
              )}
              {isLoading && trendingNfts.length === 0 && (
                <p className="text-gray-500 col-span-full opacity-50 pl-4">Loading trending...</p>
              )}
            </div>
          </section>
        )}

        {/* New Arrivals Section */}
        {!searchTerm && activeCategory === 'All' && (
          <section id="new-arrivals" className="scroll-mt-24">
            <div className="flex items-center justify-between mb-8 ps-2 border-l-4 border-purple-500 pl-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Sparkles className="w-6 h-6 text-purple-400" />
                </div>
                <h2 className="text-3xl font-bold text-white tracking-tight">New Arrivals</h2>
              </div>
              <Button variant="link" className="text-cyan-400 hover:text-cyan-300">View All</Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {newArrivals.map(nft => (
                <NFTCard key={nft.id} nft={nft} status={nft.status === 'rented' ? 'rented' : 'listing'} />
              ))}
              {isLoading && newArrivals.length === 0 && <p className="text-gray-500 col-span-full opacity-50 pl-4">Loading new arrivals...</p>}
            </div>
          </section>
        )}

        {/* Main Browse Section */}
        <section id="browse" className="scroll-mt-24">
          <div className="flex items-center gap-3 mb-8 ps-2 border-l-4 border-blue-500 pl-4">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Grid2X2 className="w-6 h-6 text-blue-400" />
            </div>
            <h2 className="text-3xl font-bold text-white tracking-tight">Browse Collection</h2>
          </div>

          {/* Filter Bar */}
          <div className="sticky top-24 z-30 bg-zinc-950/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl mb-10 transition-all">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              {/* Categories */}
              <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all whitespace-nowrap border ${activeCategory === cat
                      ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.2)]"
                      : "bg-white/5 border-white/5 hover:bg-white/10 text-gray-400 hover:text-white"
                      }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search collections..."
                    className="pl-10 bg-black/40 border-white/10 text-white placeholder:text-gray-600 focus:border-cyan-500/50 focus:ring-cyan-500/20"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select defaultValue="trending" onValueChange={setSortBy}>
                  <SelectTrigger className="w-[180px] bg-black/40 border-white/10 text-white focus:ring-cyan-500/20">
                    <ArrowUpDown className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border border-white/10 text-white">
                    <SelectItem value="trending">Trending</SelectItem>
                    <SelectItem value="price_asc">Price: Low to High</SelectItem>
                    <SelectItem value="price_desc">Price: High to Low</SelectItem>
                    <SelectItem value="recent">Recently Listed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {allNfts.length > 0 ? (
              allNfts.map(nft => (
                <NFTCard
                  key={nft.id}
                  nft={nft}
                  status={nft.status === 'rented' ? 'rented' : 'listing'}
                  onAction={(action, id) => console.log(action, id)}
                />
              ))
            ) : (
              <div className="col-span-full py-20 text-center bg-zinc-900/30 rounded-3xl border border-white/5 border-dashed">
                <div className="flex justify-center mb-4">
                  <Search className="w-12 h-12 text-gray-600 opacity-50" />
                </div>
                <h3 className="text-xl font-medium text-white mb-2">No items found</h3>
                <p className="text-gray-400">Try adjusting your search or filters to find what you're looking for.</p>
              </div>
            )}
          </div>

          {/* Pagination/Load More */}
          <div className="flex justify-center pt-12">
            <Button variant="outline" size="lg" className="min-w-[200px] border-white/10 bg-white/5 text-white hover:bg-cyan-500 hover:text-black hover:border-cyan-500 transition-all shadow-lg hover:shadow-cyan-500/25">
              Load More
            </Button>
          </div>
        </section>
      </div>

    </div>
  );
};
export default Marketplace;

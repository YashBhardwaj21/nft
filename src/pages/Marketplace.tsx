import { useState } from "react";
import { Search, SlidersHorizontal, ArrowUpDown } from "lucide-react";
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

const Marketplace = () => {
  // Mock Data
  const mockNFTs = [
    {
      id: "1",
      name: "Cosmic Wanderer #342",
      image: "https://images.unsplash.com/photo-1634193295627-1cdddf751ebf?w=400",
      price: "2.5",
      rentalPrice: "0.1",
      currency: "ETH",
      collection: "Cosmic Collection",
      creator: "ArtistX",
      timeLeft: "2d 5h",
      likes: 42
    },
    {
      id: "2",
      name: "Digital Dreams #128",
      image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400",
      price: "1.8",
      rentalPrice: "0.08",
      currency: "ETH",
      collection: "Dreams Gallery",
      creator: "CryptoArt",
      likes: 18,
      status: 'rented' // This one is rented out
    },
    {
      id: "3",
      name: "Neon Genesis #89",
      image: "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=400",
      price: "3.2",
      rentalPrice: "0.15",
      currency: "ETH",
      collection: "Neon Series",
      creator: "FutureVision",
      likes: 156
    },
    {
      id: "4",
      name: "Abstract Harmony #256",
      image: "https://images.unsplash.com/photo-1633409361618-c73427e4e206?w=400",
      price: "0.9",
      rentalPrice: "0.05",
      currency: "ETH",
      collection: "Harmony Collection",
      creator: "MinimalArt",
      likes: 34
    },
    {
      id: "5",
      name: "Cyber Punk #2077",
      image: "https://images.unsplash.com/photo-1642104704074-907c0698cbd9?w=400",
      price: "5.5",
      rentalPrice: "0.25",
      currency: "ETH",
      collection: "Cyber Series",
      creator: "PunkDev",
      timeLeft: "12h 30m",
      likes: 89
    },
    {
      id: "6",
      name: "Ethereal Ghost #11",
      image: "https://images.unsplash.com/photo-1614850523060-8da1d56ae167?w=400",
      price: "1.1",
      rentalPrice: "0.04",
      currency: "ETH",
      collection: "Ghost Protocol",
      creator: "Anon",
      likes: 67
    }
  ];

  const categories = ["All", "Art", "Gaming", "Photography", "Music", "Virtual Worlds"];
  const [activeCategory, setActiveCategory] = useState("All");

  return (
    <div className="space-y-8">

      {/* Header Section */}
      <div className="relative rounded-2xl bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-white/10 p-8 md:p-12 overflow-hidden mb-12">
        <div className="relative z-10 max-w-2xl">
          <Badge className="mb-4 bg-primary/20 text-primary border-primary/20">Marketplace</Badge>
          <h1 className="text-5xl font-bold font-heading mb-4 leading-tight">
            Discover Exclusive <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">Digital Assets</span>
          </h1>
          <p className="text-xl text-muted-foreground">
            Rent premium NFTs for utility, gaming, and art.
          </p>
        </div>
        <div className="absolute right-0 top-0 w-1/3 h-full bg-gradient-to-l from-primary/10 to-transparent pointer-events-none" />
      </div>

      {/* Filter Bar */}
      <div className="sticky top-24 z-30 bg-background/80 backdrop-blur-xl border border-white/5 rounded-xl p-4 shadow-lg">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">

          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${activeCategory === cat
                    ? "bg-primary text-black"
                    : "bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white"
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input placeholder="Search collections..." className="pl-10 bg-white/5 border-white/10" />
            </div>
            <Select defaultValue="trending">
              <SelectTrigger className="w-[180px] bg-white/5 border-white/10">
                <ArrowUpDown className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trending">Trending</SelectItem>
                <SelectItem value="price_asc">Price: Low to High</SelectItem>
                <SelectItem value="price_desc">Price: High to Low</SelectItem>
                <SelectItem value="recent">Recently Listed</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="border-white/10 bg-white/5">
              <SlidersHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {mockNFTs.map(nft => (
          <NFTCard
            key={nft.id}
            nft={nft}
            status={nft.status === 'rented' ? 'rented' : 'listing'}
            onAction={(action, id) => console.log(action, id)}
          />
        ))}
      </div>

      {/* Pagination/Load More */}
      <div className="flex justify-center pt-8">
        <Button variant="outline" size="lg" className="min-w-[200px]">
          Load More
        </Button>
      </div>
    </div>
  );
};

export default Marketplace;

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus, TrendingUp, Clock, Wallet, LayoutGrid, Sparkles, ArrowUpRight,
  History, DollarSign, ExternalLink, LogOut, Copy
} from 'lucide-react';
import NFTCard from '@/components/ui/nft-card';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { NFT, Listing, RentalHistoryItem, EarningHistoryItem, UserStats } from '../types';
import { toast } from 'sonner';
import RentListingModal from '@/components/rentals/RentListingModal';
import MintModal from '@/components/mint/MintModal';
import { Badge } from '@/components/ui/badge';
import { WalletConnectButton } from '@/components/WalletConnectButton';
import { useSendTransaction } from 'wagmi';

const MyNFTs = () => {
  const { user, isAuthenticated, logout, loading: authLoading } = useAuth();
  const { sendTransactionAsync } = useSendTransaction();
  console.log("MyNFTs Render: isAuthenticated=", isAuthenticated, "authLoading=", authLoading);
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('owned');
  const [ownedNFTs, setOwnedNFTs] = useState<NFT[]>([]);
  const [rentedNFTs, setRentedNFTs] = useState<NFT[]>([]);
  const [activeListings, setActiveListings] = useState<Listing[]>([]);
  const [rentalHistory, setRentalHistory] = useState<RentalHistoryItem[]>([]);
  const [earningsHistory, setEarningsHistory] = useState<EarningHistoryItem[]>([]);

  const [isLoading, setIsLoading] = useState(true);

  // Rental Modal State
  const [isRentModalOpen, setIsRentModalOpen] = useState(false);
  const [isMintModalOpen, setIsMintModalOpen] = useState(false);
  const [selectedNftForRent, setSelectedNftForRent] = useState<NFT | null>(null);

  const [stats, setStats] = useState({
    totalNFTs: 0,
    totalValue: '0',
    activeListings: 0,
    totalRentals: 0,
    totalEarnings: '0',
    activeRentedOut: 0
  });

  useEffect(() => {
    if (user?.id) {
      fetchUserData();
    }
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0b14] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0b14] flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <Wallet className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-white">Connect & Sign In</h1>
          <p className="text-gray-400">
            To view your dashboard, assets, and history, you need to verify your wallet ownership securely.
          </p>
          <div className="flex justify-center scale-125">
            <WalletConnectButton />
          </div>
        </div>
      </div>
    );
  }

  const fetchUserData = async () => {
    // Start loading but don't clear previous data immediately if refreshed
    // if (activeTab === 'owned' && ownedNFTs.length === 0) setIsLoading(true);

    try {
      const [ownedRes, rentedRes, listingsRes, statsRes, historyRes, earningsRes] = await Promise.all([
        api.get(`/users/${user?.id}/owned`),
        api.get(`/users/${user?.id}/rented`),
        api.get(`/users/${user?.id}/listings`),
        api.get(`/users/${user?.id}/stats`),
        api.get(`/users/${user?.id}/history`),
        api.get(`/users/${user?.id}/earnings`)
      ]);

      setOwnedNFTs(ownedRes.data.data || []);
      setRentedNFTs(rentedRes.data.data || []);
      setActiveListings(listingsRes.data.data || []);
      setRentalHistory(historyRes.data.data || []);
      setEarningsHistory(earningsRes.data.data || []);

      const userStats: UserStats = statsRes.data.data;
      setStats({
        totalNFTs: userStats.totalNFTs || 0,
        totalValue: `${userStats.totalValue || 0} ETH`,
        activeListings: userStats.activeListings || 0,
        totalRentals: userStats.totalRentals || 0,
        totalEarnings: `${userStats.totalEarnings || 0} ETH`,
        activeRentedOut: userStats.activeRentedOut || 0
      });

    } catch (error) {
      console.error("Error fetching user data:", error);
      toast.error("Failed to load your dashboard data");
    } finally {
      setIsLoading(false);
    }
  };

  const dashboardStats = [
    {
      label: "Assets",
      value: stats.totalNFTs.toString(),
      icon: Wallet,
      color: "from-blue-500 to-indigo-600",
      shadow: "shadow-blue-500/20"
    },
    {
      label: "Listed",
      value: stats.activeListings.toString(),
      icon: LayoutGrid,
      color: "from-amber-400 to-orange-600",
      shadow: "shadow-orange-500/20"
    },
    {
      label: "Renting",
      value: stats.totalRentals.toString(),
      icon: Clock,
      color: "from-pink-500 to-rose-600",
      shadow: "shadow-pink-500/20"
    },
    {
      label: "Earnings",
      value: stats.totalEarnings,
      icon: DollarSign,
      color: "from-emerald-400 to-teal-600",
      shadow: "shadow-emerald-500/20"
    },
  ];

  const handleListForRent = (nft: NFT) => {
    setSelectedNftForRent(nft);
    setIsRentModalOpen(true);
  };

  const handleReturn = async (nftId: string) => {
    try {
      await api.put(`/rentals/return/${nftId}`);
      toast.success("NFT Returned successfully");
      fetchUserData();
    } catch (e: any) {
      console.error(e);
      toast.error(e.response?.data?.error || "Failed to return NFT");
    }
  };

  const handleAction = (action: string, id: string) => {
    if (action === 'list') {
      const nft = ownedNFTs.find(n => n.id === id);
      if (nft) handleListForRent(nft);
    } else if (action === 'return') {
      handleReturn(id);
    } else if (action === 'remove-listing') {
      handleRemoveListing(id);
    } else if (action === 'delete') {
      handleDeleteNFT(id);
    }
  };

  const handleRemoveListing = async (listingIdOrNftId: string) => {
    let toastId;
    try {
      const listing = activeListings.find(l => l.id === listingIdOrNftId || l.nft?.id === listingIdOrNftId || l.nftId === listingIdOrNftId);
      if (!listing) return;

      if (listing.status === 'ACTIVE') {
        toastId = toast.loading('Generating cancellation transaction...');

        // 1. Get transaction payload
        const response = await api.post('/marketplace/cancel/generate', { listingId: listing.id });
        const txData = response.data.data;

        toast.loading('Please confirm transaction in your wallet...', { id: toastId });

        // 2. Send transaction via Wagmi
        const hash = await sendTransactionAsync({
          to: txData.to,
          data: txData.data
        });

        toast.loading('Confirming on blockchain...', { id: toastId });

        // 3. Notify backend
        await api.post('/marketplace/cancel/notify', {
          onChainListingId: listing.onChainListingId,
          txHash: hash
        }, { headers: { 'Idempotency-Key': crypto.randomUUID() } });

        toast.success('Cancellation submitted! It will be removed once confirmed.', { id: toastId });
      } else {
        // Drop local drafts
        await api.delete(`/marketplace/listings/${listing.id}/cancel`);
        toast.success('Draft listing removed.');
        setActiveListings(prev => prev.filter((l: any) => l.id !== listing.id));
      }
    } catch (e: any) {
      console.error(e);
      const errorMsg = e.response?.data?.error || e.message || 'Failed to remove listing';
      if (toastId) {
        toast.error(errorMsg, { id: toastId });
      } else {
        toast.error(errorMsg);
      }
    }
  };

  const handleDeleteNFT = async (nftId: string) => {
    if (!window.confirm('Permanently delete this NFT from your collection? This cannot be undone.')) return;
    try {
      await api.delete(`/nfts/${nftId}`);
      toast.success('NFT deleted from your collection.');
      setOwnedNFTs(prev => prev.filter(n => n.id !== nftId));
    } catch (e: any) {
      console.error(e);
      toast.error(e.response?.data?.error || 'Failed to delete NFT');
    }
  };

  const copyWallet = () => {
    if (user?.walletAddress) {
      navigator.clipboard.writeText(user.walletAddress);
      toast.success("Address copied");
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white selection:bg-primary/30 pb-20 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">

        {/* Subtle Background Glows */}
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-[120px] pointer-events-none" />

        {/* TOP SECTION: Profile & Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-12 relative z-10">

          {/* Profile Card */}
          <div className="lg:col-span-4 xl:col-span-3">
            <div className="h-full p-6 rounded-3xl border border-white/10 flex flex-col justify-between relative overflow-hidden group">
              {/* Background Image & Overlay */}
              <div className="absolute inset-0 z-0">
                <img src="/ww.jpg" alt="Profile Background" className="w-full h-full object-cover opacity-100 transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-b from-[#0a0b14]/60 via-[#0a0b14]/80 to-[#0a0b14]" />
              </div>

              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 p-[2px] shadow-lg shadow-purple-500/20 shrink-0">
                    <div className="w-full h-full rounded-[14px] bg-[#0a0b14] flex items-center justify-center overflow-hidden">
                      {user?.profileImage ? (
                        <img src={user.profileImage} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl font-bold text-white tracking-wider">{user?.username?.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                  </div>
                  <div className="overflow-hidden">
                    <h2 className="text-xl font-bold text-white truncate drop-shadow-md">{user?.username || 'User'}</h2>
                    <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium bg-emerald-400/10 px-2.5 py-1 rounded-full w-fit mt-1 backdrop-blur-md border border-emerald-400/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="drop-shadow-sm">Online</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    className="w-full p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between group/wallet hover:border-white/20 hover:bg-black/60 transition-all active:scale-[0.98] backdrop-blur-sm"
                    onClick={copyWallet}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="p-1.5 rounded-lg bg-white/5 shrink-0">
                        <Wallet className="w-3.5 h-3.5 text-gray-300" />
                      </div>
                      <div className="flex flex-col items-start overflow-hidden">
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Wallet</span>
                        <span className="text-sm font-mono text-gray-200 truncate w-full text-left">
                          {user?.walletAddress ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}` : '0x...'}
                        </span>
                      </div>
                    </div>
                    <Copy className="w-3.5 h-3.5 text-gray-500 group-hover/wallet:text-white transition-colors shrink-0" />
                  </button>

                  <div className="flex items-center justify-between px-1">
                    <span className="text-gray-400 text-xs font-medium">Network</span>
                    <Badge variant="outline" className="bg-indigo-500/20 text-indigo-200 border-indigo-500/30 text-[10px] px-2 h-5 backdrop-blur-sm shadow-lg shadow-indigo-500/10">Sepolia</Badge>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-white/10 flex gap-3 relative z-10">
                <Button variant="outline" className="flex-1 border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl h-10 text-xs font-medium active:text-white focus:text-white backdrop-blur-sm" asChild>
                  <a href={`https://sepolia.etherscan.io/address/${user?.walletAddress}`} target="_blank" rel="noreferrer">
                    Etherscan <ExternalLink className="w-3 h-3 ml-2 opacity-70" />
                  </a>
                </Button>
                <Button variant="destructive" size="icon" onClick={logout} className="rounded-xl h-10 w-10 bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30 active:text-red-200 backdrop-blur-sm">
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Stats Grid - SOLID VIBRANT COLORS */}
          <div className="lg:col-span-8 xl:col-span-9 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {isLoading ? (
              // Skeleton Loading States
              [...Array(4)].map((_, i) => (
                <div key={i} className="h-32 rounded-3xl bg-[#12141f] border border-white/5 animate-pulse relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12 animate-shimmer" />
                </div>
              ))
            ) : (
              dashboardStats.map((stat) => (
                <div
                  key={stat.label}
                  className={`
                        relative overflow-hidden p-6 rounded-[1.5rem] border border-white/5
                        bg-gradient-to-br ${stat.color} ${stat.shadow}
                        hover:brightness-110 transition-all duration-300
                        flex flex-col justify-between group h-32 hover:-translate-y-1 shadow-lg
                        `}
                >
                  {/* Overlay Texture */}
                  <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-10 transition-opacity" />

                  <div className="flex justify-between items-start relative z-10">
                    <p className="text-[10px] font-bold text-white/80 tracking-widest uppercase">
                      {stat.label}
                    </p>
                    <div className="p-2 rounded-xl bg-white/20 backdrop-blur-md text-white ring-1 ring-white/20">
                      <stat.icon className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="mt-2 relative z-10">
                    <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight truncate drop-shadow-md">
                      {stat.value}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">

          {/* LEFT: Tabs (Main Dashboard) */}
          <div className="lg:col-span-8 xl:col-span-9">
            <Tabs value={activeTab} className="w-full" onValueChange={setActiveTab}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                <TabsList className="bg-[#12141f] border border-white/5 p-1 h-16 rounded-[1.25rem] w-full flex items-center gap-1 shadow-lg shadow-black/20">
                  {['Collection', 'Renting', 'Listings', 'History'].map((tab) => {
                    const mapValue = tab === 'Collection' ? 'owned' : tab === 'Renting' ? 'rented' : tab === 'Listings' ? 'listings' : 'history';

                    // Color Map
                    const colors = {
                      owned: "data-[state=active]:bg-blue-600 data-[state=active]:shadow-blue-500/30",
                      rented: "data-[state=active]:bg-pink-600 data-[state=active]:shadow-pink-500/30",
                      listings: "data-[state=active]:bg-amber-600 data-[state=active]:shadow-amber-500/30",
                      history: "data-[state=active]:bg-emerald-600 data-[state=active]:shadow-emerald-500/30",
                    };
                    const activeColorClass = colors[mapValue as keyof typeof colors] || "data-[state=active]:bg-primary";

                    return (
                      <TabsTrigger
                        key={tab}
                        value={mapValue}
                        className={`
                                            flex-1 h-full rounded-2xl text-sm font-bold text-gray-400 
                                            hover:text-white transition-all 
                                            data-[state=active]:text-white data-[state=active]:shadow-lg
                                            ${activeColorClass}
                                        `}
                      >
                        {tab}
                      </TabsTrigger>
                    )
                  })}
                </TabsList>

                {/* Mobile Action Buttons (Visible on Mobile/Tablet) */}
                <div className="flex lg:hidden gap-2 w-full sm:w-auto mt-4 sm:mt-0">
                  <Button className="flex-1 sm:flex-none rounded-xl bg-primary text-black font-bold hover:bg-primary/90 shadow-lg shadow-primary/20 h-12" onClick={() => navigate('/marketplace')}>
                    <ArrowUpRight className="w-4 h-4 mr-2" /> Browse
                  </Button>
                </div>
              </div>

              <div className="min-h-[400px]">
                {/* OWNED TAB */}
                <TabsContent value="owned" className="animate-in fade-in-50 duration-300 focus-visible:outline-none focus:outline-none">
                  <h3 className="text-lg font-bold mb-5 flex items-center gap-2 text-white"><Wallet className="w-5 h-5 text-blue-500" /> Your Assets</h3>

                  {isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="aspect-[4/5] rounded-[1.5rem] bg-[#12141f] animate-pulse" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                      {ownedNFTs.map((nft) => (
                        <NFTCard key={nft.id} nft={nft} status="owned" onAction={handleAction} />
                      ))}
                      {/* Mint Placeholder */}
                      <button className="border border-dashed border-white/10 rounded-[1.5rem] bg-white/[0.02] flex flex-col items-center justify-center cursor-pointer hover:bg-white/[0.05] hover:border-blue-500/30 transition-all duration-300 aspect-[4/5] sm:aspect-auto sm:min-h-[400px] group w-full text-left" onClick={() => setIsMintModalOpen(true)}>
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300 shadow-xl group-hover:shadow-blue-500/20">
                          <Plus className="w-8 h-8 text-gray-400 group-hover:text-white" />
                        </div>
                        <h3 className="text-lg font-bold mb-1 text-white">Mint New</h3>
                        <p className="text-gray-500 text-center px-4 text-xs">
                          Add to your collection
                        </p>
                      </button>
                    </div>
                  )}
                </TabsContent>

                {/* RENTED TAB */}
                <TabsContent value="rented" className="animate-in fade-in-50 duration-300 focus-visible:outline-none focus:outline-none">
                  <h3 className="text-lg font-bold mb-5 flex items-center gap-2 text-white"><Clock className="w-5 h-5 text-pink-500" /> Active Rentals</h3>

                  {isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="aspect-[4/5] rounded-[1.5rem] bg-[#12141f] animate-pulse" />
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                        {rentedNFTs.map((nft) => (
                          <NFTCard key={nft.id} nft={nft} status="rented" onAction={handleAction} />
                        ))}
                      </div>
                      {rentedNFTs.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-center border border-white/5 rounded-[1.5rem] bg-[#12141f]/50">
                          <div className="w-16 h-16 bg-pink-500/10 rounded-full flex items-center justify-center mb-4">
                            <Sparkles className="w-7 h-7 text-pink-500" />
                          </div>
                          <h3 className="text-lg font-bold mb-1 text-white">No Active Rentals</h3>
                          <p className="text-gray-500 max-w-xs mb-6 text-sm">Find unique assets to rent.</p>
                          <Button variant="outline" onClick={() => navigate('/marketplace')} className="border-pink-500/30 text-pink-400 hover:bg-pink-500/10 h-10 px-6 rounded-full active:text-pink-200">
                            Explore <ArrowUpRight className="w-4 h-4 ml-2" />
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>

                {/* LISTINGS TAB */}
                <TabsContent value="listings" className="animate-in fade-in-50 duration-300 focus-visible:outline-none focus:outline-none">
                  <h3 className="text-lg font-bold mb-5 flex items-center gap-2 text-white"><LayoutGrid className="w-5 h-5 text-amber-500" /> Your Listings</h3>

                  {isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="aspect-[4/5] rounded-[1.5rem] bg-[#12141f] animate-pulse" />
                      ))}
                    </div>
                  ) : (
                    <>
                      {activeListings.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                          {activeListings.map((listing: any) => (
                            <NFTCard
                              key={listing.id}
                              nft={{ ...listing.nft, id: listing.nft.id || listing.nftId, collectionName: listing.nft?.collectionName || listing.nft?.collection, price: listing.price, rentalPrice: listing.rentalPrice }}
                              status={['LOCAL_DRAFT', 'PENDING_CREATE', 'PENDING_CANCEL'].includes(listing.status) ? 'published_pending' : (listing.status === 'RENTED' ? 'rented' : 'listing')}
                              isOwner={true}
                              onAction={handleAction}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-20 border border-white/5 rounded-[1.5rem] bg-[#12141f]/50">
                          <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-4">
                            <LayoutGrid className="w-7 h-7 text-amber-500" />
                          </div>
                          <h3 className="text-lg font-bold mb-1 text-white">No Listings</h3>
                          <p className="text-gray-500 mb-6 max-w-xs text-center text-sm">
                            List your NFTs to earn passive income.
                          </p>
                          <Button onClick={() => setActiveTab('owned')} className="bg-white text-black hover:bg-gray-200 rounded-full px-8 h-10 font-bold active:text-black shadow-lg">
                            View Collection
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>

                {/* HISTORY TAB */}
                <TabsContent value="history" className="animate-in fade-in-50 duration-300 focus-visible:outline-none focus:outline-none">
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

                    {/* Rental History */}
                    <div>
                      <div className="flex items-center gap-3 mb-5">
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                          <History className="w-4 h-4" />
                        </div>
                        <h3 className="text-lg font-bold text-white">Rental History</h3>
                      </div>
                      <div className="space-y-3">
                        {isLoading ? (
                          [...Array(3)].map((_, i) => (
                            <div key={i} className="h-20 rounded-xl bg-[#12141f] animate-pulse" />
                          ))
                        ) : rentalHistory.length > 0 ? rentalHistory.map((item, i) => (
                          <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-[#12141f] border border-white/5 hover:border-white/10 transition-colors group">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-lg bg-black/40 overflow-hidden border border-white/5 shrink-0">
                                {item.nftImage && <img src={item.nftImage} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />}
                              </div>
                              <div>
                                <p className="font-bold text-sm text-white group-hover:text-primary transition-colors">{item.nftName}</p>
                                <p className="text-[10px] text-gray-500 mt-0.5">{new Date(item.startDate).toLocaleDateString()}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-sm text-white">-{item.price} ETH</p>
                              <Badge variant="outline" className="mt-1 bg-white/5 border-white/10 text-gray-400 text-[10px] uppercase tracking-wider">{item.status}</Badge>
                            </div>
                          </div>
                        )) : (
                          <p className="text-gray-500 text-sm italic py-4">No rental history available.</p>
                        )}
                      </div>
                    </div>

                    {/* Earnings History */}
                    <div>
                      <div className="flex items-center gap-3 mb-5">
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                          <DollarSign className="w-4 h-4" />
                        </div>
                        <h3 className="text-lg font-bold text-white">Income Log</h3>
                      </div>
                      <div className="space-y-3">
                        {isLoading ? (
                          [...Array(3)].map((_, i) => (
                            <div key={i} className="h-20 rounded-xl bg-[#12141f] animate-pulse" />
                          ))
                        ) : earningsHistory.length > 0 ? earningsHistory.map((item, i) => (
                          <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-[#12141f] border border-white/5 hover:border-white/10 transition-colors group">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20 shrink-0">
                                <DollarSign className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="font-bold text-sm text-white">Rental Income</p>
                                <p className="text-[10px] text-gray-500 mt-0.5">{new Date(item.date).toLocaleDateString()}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-sm text-emerald-400">+{item.amount} ETH</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">Direct Payout</p>
                            </div>
                          </div>
                        )) : (
                          <p className="text-gray-500 text-sm italic py-4">No earnings recorded yet.</p>
                        )}
                      </div>
                    </div>

                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>

          {/* RIGHT: Action Panel & Widgets (Now visible on lg screens) */}
          <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-6 lg:sticky lg:top-24 h-fit">

            {/* Quick Actions */}
            <div className="p-6 rounded-[2rem] bg-[#12141f] border border-white/5 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <h3 className="text-lg font-bold mb-5 text-white flex items-center gap-2 relative z-10">
                <Sparkles className="w-4 h-4 text-primary" /> Quick Actions
              </h3>
              <div className="space-y-3 relative z-10">
                <Button className="w-full justify-start h-12 text-sm font-bold rounded-xl bg-white text-black hover:bg-gray-200 transition-all shadow-lg shadow-white/5 active:text-black focus:text-black" variant="default" onClick={() => setIsMintModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-3" /> Mint New NFT
                </Button>
                <Button className="w-full justify-start h-12 text-sm font-medium rounded-xl border-white/10 bg-white/5 hover:bg-white/10 hover:text-white text-gray-300 transition-all active:text-white focus:text-white" variant="outline" onClick={() => setActiveTab('listings')}>
                  <LayoutGrid className="w-4 h-4 mr-3" /> Manage Listings
                </Button>
                <Button className="w-full justify-start h-12 text-sm font-medium rounded-xl border-white/10 bg-white/5 hover:bg-white/10 hover:text-white text-gray-300 transition-all active:text-white focus:text-white" variant="outline" onClick={() => navigate('/marketplace')}>
                  <ArrowUpRight className="w-4 h-4 mr-3" /> Browse Market
                </Button>
              </div>
            </div>

            {/* Market Widget (Mock) */}
            <div className="p-6 rounded-[2rem] bg-[#12141f] border border-white/5">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-bold text-white">Floor Prices</h3>
                <div className="px-2 py-0.5 rounded-md bg-green-500/10 text-green-400 text-[10px] font-bold flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Live
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between group cursor-pointer hover:bg-white/5 p-2 -mx-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-800 border border-white/5 shrink-0"></div>
                    <span className="font-bold text-sm text-gray-300 group-hover:text-white transition-colors">Bored Ape</span>
                  </div>
                  <span className="font-mono font-bold text-sm text-white">12.4 ETH</span>
                </div>
                <div className="flex items-center justify-between group cursor-pointer hover:bg-white/5 p-2 -mx-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-red-900/30 border border-white/5 shrink-0"></div>
                    <span className="font-bold text-sm text-gray-300 group-hover:text-white transition-colors">Azuki</span>
                  </div>
                  <span className="font-mono font-bold text-sm text-white">7.8 ETH</span>
                </div>
                <div className="flex items-center justify-between group cursor-pointer hover:bg-white/5 p-2 -mx-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-900/30 border border-white/5 shrink-0"></div>
                    <span className="font-bold text-sm text-gray-300 group-hover:text-white transition-colors">Pudgy</span>
                  </div>
                  <span className="font-mono font-bold text-sm text-white">3.2 ETH</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        <RentListingModal
          isOpen={isRentModalOpen}
          onClose={() => setIsRentModalOpen(false)}
          nft={selectedNftForRent}
          onSuccess={() => {
            fetchUserData();
            setIsRentModalOpen(false);
            toast.success("Listing created successfully");
          }}
        />

        <MintModal
          isOpen={isMintModalOpen}
          onClose={() => setIsMintModalOpen(false)}
          onSuccess={() => {
            fetchUserData();
            // keep open on success if desired, but MintModal handles its own success state view
            // Actually MintModal calls onSuccess when clicking 'Close' or after finishing if designed so.
            // But looking at MintModal code, it calls onSuccess() inside the confirmation block but doesn't close automatically.
            // Let's rely on fetchUserData to refresh the list.
          }}
        />
      </div>
    </div>
  );
};

export default MyNFTs;
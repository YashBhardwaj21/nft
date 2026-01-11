import { Link } from "react-router-dom";

const Footer = () => {
    return (
        <footer className="border-t border-white/10 bg-black/40 backdrop-blur-xl mt-auto">
            <div className="container-wide py-12">
                <div className="grid grid-cols-4 gap-8">
                    <div className="space-y-4">
                        <Link to="/" className="flex items-center space-x-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center">
                                <div className="w-4 h-4 bg-white rounded-sm" />
                            </div>
                            <span className="text-xl font-bold font-heading">RentableNFT</span>
                        </Link>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            The first decentralized marketplace for renting and lending digital assets. Secure, transparent, and built for the future.
                        </p>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-4 text-white">Marketplace</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><Link to="/marketplace" className="hover:text-primary transition-colors">All NFTs</Link></li>
                            <li><Link to="/marketplace?category=art" className="hover:text-primary transition-colors">Art</Link></li>
                            <li><Link to="/marketplace?category=gaming" className="hover:text-primary transition-colors">Gaming</Link></li>
                            <li><Link to="/marketplace?category=utility" className="hover:text-primary transition-colors">Utility</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-4 text-white">Account</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><Link to="/my-nfts" className="hover:text-primary transition-colors">My Collection</Link></li>
                            <li><Link to="/login" className="hover:text-primary transition-colors">Connect Wallet</Link></li>
                            <li><Link to="/settings" className="hover:text-primary transition-colors">Settings</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-4 text-white">Legal</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><a href="#" className="hover:text-primary transition-colors">Privacy Policy</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Terms of Service</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Cookie Policy</a></li>
                        </ul>
                    </div>
                </div>
                <div className="mt-12 pt-8 border-t border-white/5 flex justify-between items-center text-xs text-muted-foreground">
                    <p>&copy; {new Date().getFullYear()} RentableNFT DAO. All rights reserved.</p>
                    <div className="flex gap-4">
                        <a href="#" className="hover:text-white transition-colors">Twitter</a>
                        <a href="#" className="hover:text-white transition-colors">Discord</a>
                        <a href="#" className="hover:text-white transition-colors">GitHub</a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;

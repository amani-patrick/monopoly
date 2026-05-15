import { 
  Wallet, User, Trophy, LogOut, Settings, Shield, 
  Dices, Home, Copy, Lock, Users, Eye, Send, X, Check, 
  Info, ChevronDown, ChevronRight, Star, Bot, Crown, 
  House, Hotel, ArrowUp, ArrowDown, Trash, Plus, Play, RefreshCw,
  Search, ExternalLink, Mail, Phone, CreditCard, LayoutDashboard,
  AlertTriangle, History, Gift, ShoppingBag, Languages, Palette,
  Globe, Bell, MessageSquare, Handshake, Gavel, Ban, Clock
} from 'lucide-react';
import React from 'react';


const iconProps = {
  size: 16,
  strokeWidth: 2,
};

export const WalletIcon    = () => <Wallet {...iconProps} />;
export const UserIcon      = () => <User {...iconProps} />;
export const TrophyIcon    = () => <Trophy {...iconProps} />;
export const LogOutIcon    = () => <LogOut {...iconProps} />;
export const SettingsIcon  = () => <Settings {...iconProps} />;
export const ShieldIcon    = () => <Shield {...iconProps} />;
export const DiceIcon      = () => <Dices {...iconProps} />;
export const HomeIcon      = () => <Home {...iconProps} />;
export const CopyIcon      = () => <Copy {...iconProps} />;
export const LockIcon      = () => <Lock {...iconProps} />;
export const UsersIcon     = () => <Users {...iconProps} />;
export const EyeIcon       = () => <Eye {...iconProps} />;
export const SendIcon      = () => <Send {...iconProps} />;
export const XIcon         = () => <X {...iconProps} />;
export const CheckIcon     = () => <Check {...iconProps} />;
export const InfoIcon      = () => <Info {...iconProps} />;
export const ChevronDownIcon = () => <ChevronDown {...iconProps} />;
export const ChevronRightIcon = () => <ChevronRight {...iconProps} />;
export const StarIcon      = ({ filled }: { filled?: boolean }) => <Star {...iconProps} fill={filled ? 'currentColor' : 'none'} />;
export const BotIcon       = () => <Bot {...iconProps} />;
export const CrownIcon     = () => <Crown {...iconProps} />;
export const HouseIcon     = () => <House {...iconProps} />;
export const HotelIcon     = () => <Hotel {...iconProps} />;
export const ArrowUpIcon   = () => <ArrowUp {...iconProps} />;
export const ArrowDownIcon = () => <ArrowDown {...iconProps} />;
export const TrashIcon     = () => <Trash {...iconProps} />;
export const PlusIcon      = () => <Plus {...iconProps} />;
export const PlayIcon      = () => <Play {...iconProps} />;
export const RefreshIcon   = () => <RefreshCw {...iconProps} />;

// New icons for enhanced UI
export const SearchIcon    = () => <Search {...iconProps} />;
export const LinkIcon      = () => <ExternalLink {...iconProps} />;
export const MailIcon      = () => <Mail {...iconProps} />;
export const PhoneIcon     = () => <Phone {...iconProps} />;
export const CardIcon      = () => <CreditCard {...iconProps} />;
export const DashboardIcon = () => <LayoutDashboard {...iconProps} />;
export const AlertIcon     = () => <AlertTriangle {...iconProps} />;
export const HistoryIcon   = () => <History {...iconProps} />;
export const GiftIcon      = () => <Gift {...iconProps} />;
export const StoreIcon     = () => <ShoppingBag {...iconProps} />;
export const LanguageIcon  = () => <Languages {...iconProps} />;
export const PaletteIcon   = () => <Palette {...iconProps} />;
export const GlobeIcon     = () => <Globe {...iconProps} />;
export const BellIcon      = () => <Bell {...iconProps} />;
export const ChatIcon      = () => <MessageSquare {...iconProps} />;
export const TradeIcon     = () => <Handshake {...iconProps} />;
export const AuctionIcon   = () => <Gavel {...iconProps} />;
export const BanIcon       = () => <Ban {...iconProps} />;
export const ClockIcon     = () => <Clock {...iconProps} />;
export const GavelIcon     = () => <Gavel {...iconProps} />;

import type { LucideIcon } from 'lucide-react';
import {
  Wallet, User, Trophy, LogOut, Settings, Shield,
  Dices, Home, Copy, Lock, Users, Eye, Send, X, Check,
  Info, ChevronDown, ChevronRight, Star, Bot, Crown,
  Hotel, ArrowUp, ArrowDown, Trash, Plus, Play, RefreshCw,
  Search, ExternalLink, Mail, Phone, CreditCard, LayoutDashboard,
  AlertTriangle, History, Gift, ShoppingBag, Languages, Palette,
  Globe, Bell, MessageSquare, Handshake, Gavel, Ban, Clock,
  Zap, Trees, Sun, Moon, Flame, Map, Gamepad2, Coins,
  BarChart3, Pencil, Plane, Gem, Target, Building2, Lightbulb,
  Building, HelpCircle, Umbrella, Hammer, Landmark, Shuffle,
  Hourglass, Medal, MapPin, CircleDollarSign, ClipboardList,
  Skull, PartyPopper, Banknote, ArrowDownToLine, ArrowUpFromLine,
  Smartphone, Circle, Sparkles, Store, Construction,
} from 'lucide-react';
import React from 'react';

export type IconProps = {
  size?: number;
  strokeWidth?: number;
  className?: string;
  color?: string;
};

const DEFAULT_SIZE = 16;
const DEFAULT_STROKE = 2;

function createIcon(Icon: LucideIcon, displayName: string) {
  const Comp = ({
    size = DEFAULT_SIZE,
    strokeWidth = DEFAULT_STROKE,
    className,
    color,
  }: IconProps) => (
    <Icon size={size} strokeWidth={strokeWidth} className={className} color={color} />
  );
  Comp.displayName = displayName;
  return Comp;
}

export const WalletIcon = createIcon(Wallet, 'WalletIcon');
export const UserIcon = createIcon(User, 'UserIcon');
export const TrophyIcon = createIcon(Trophy, 'TrophyIcon');
export const LogOutIcon = createIcon(LogOut, 'LogOutIcon');
export const SettingsIcon = createIcon(Settings, 'SettingsIcon');
export const ShieldIcon = createIcon(Shield, 'ShieldIcon');
export const DiceIcon = createIcon(Dices, 'DiceIcon');
export const HomeIcon = createIcon(Home, 'HomeIcon');
/** @deprecated Use HomeIcon */
export const HouseIcon = HomeIcon;
export const CopyIcon = createIcon(Copy, 'CopyIcon');
export const LockIcon = createIcon(Lock, 'LockIcon');
export const UsersIcon = createIcon(Users, 'UsersIcon');
export const EyeIcon = createIcon(Eye, 'EyeIcon');
export const SendIcon = createIcon(Send, 'SendIcon');
export const XIcon = createIcon(X, 'XIcon');
export const CheckIcon = createIcon(Check, 'CheckIcon');
export const InfoIcon = createIcon(Info, 'InfoIcon');
export const ChevronDownIcon = createIcon(ChevronDown, 'ChevronDownIcon');
export const ChevronRightIcon = createIcon(ChevronRight, 'ChevronRightIcon');
export const StarIcon = ({ filled, ...props }: IconProps & { filled?: boolean }) => (
  <Star {...props} size={props.size ?? DEFAULT_SIZE} strokeWidth={props.strokeWidth ?? DEFAULT_STROKE} fill={filled ? 'currentColor' : 'none'} />
);
export const BotIcon = createIcon(Bot, 'BotIcon');
export const CrownIcon = createIcon(Crown, 'CrownIcon');
export const HotelIcon = createIcon(Hotel, 'HotelIcon');
export const ArrowUpIcon = createIcon(ArrowUp, 'ArrowUpIcon');
export const ArrowDownIcon = createIcon(ArrowDown, 'ArrowDownIcon');
export const TrashIcon = createIcon(Trash, 'TrashIcon');
export const PlusIcon = createIcon(Plus, 'PlusIcon');
export const PlayIcon = createIcon(Play, 'PlayIcon');
export const RefreshIcon = createIcon(RefreshCw, 'RefreshIcon');
export const SearchIcon = createIcon(Search, 'SearchIcon');
export const LinkIcon = createIcon(ExternalLink, 'LinkIcon');
export const MailIcon = createIcon(Mail, 'MailIcon');
export const PhoneIcon = createIcon(Phone, 'PhoneIcon');
export const CardIcon = createIcon(CreditCard, 'CardIcon');
export const DashboardIcon = createIcon(LayoutDashboard, 'DashboardIcon');
export const AlertIcon = createIcon(AlertTriangle, 'AlertIcon');
export const HistoryIcon = createIcon(History, 'HistoryIcon');
export const GiftIcon = createIcon(Gift, 'GiftIcon');
export const StoreIcon = createIcon(ShoppingBag, 'StoreIcon');
export const LanguageIcon = createIcon(Languages, 'LanguageIcon');
export const PaletteIcon = createIcon(Palette, 'PaletteIcon');
export const GlobeIcon = createIcon(Globe, 'GlobeIcon');
export const BellIcon = createIcon(Bell, 'BellIcon');
export const ChatIcon = createIcon(MessageSquare, 'ChatIcon');
export const TradeIcon = createIcon(Handshake, 'TradeIcon');
export const AuctionIcon = createIcon(Gavel, 'AuctionIcon');
export const BanIcon = createIcon(Ban, 'BanIcon');
export const ClockIcon = createIcon(Clock, 'ClockIcon');
export const GavelIcon = createIcon(Gavel, 'GavelIcon');
export const CyberIcon = createIcon(Zap, 'CyberIcon');
export const NatureIcon = createIcon(Trees, 'NatureIcon');
export const NeonIcon = createIcon(Sun, 'NeonIcon');
export const ClassicIcon = createIcon(Moon, 'ClassicIcon');
export const FlameIcon = createIcon(Flame, 'FlameIcon');
export const MapIcon = createIcon(Map, 'MapIcon');
export const GamepadIcon = createIcon(Gamepad2, 'GamepadIcon');
export const CoinsIcon = createIcon(Coins, 'CoinsIcon');
export const ChartIcon = createIcon(BarChart3, 'ChartIcon');
export const PencilIcon = createIcon(Pencil, 'PencilIcon');
export const PlaneIcon = createIcon(Plane, 'PlaneIcon');
export const GemIcon = createIcon(Gem, 'GemIcon');
export const TargetIcon = createIcon(Target, 'TargetIcon');
export const BankIcon = createIcon(Building2, 'BankIcon');
export const LightbulbIcon = createIcon(Lightbulb, 'LightbulbIcon');
export const OfficeIcon = createIcon(Building, 'OfficeIcon');
export const HelpIcon = createIcon(HelpCircle, 'HelpIcon');
export const VacationIcon = createIcon(Umbrella, 'VacationIcon');
export const HammerIcon = createIcon(Hammer, 'HammerIcon');
export const PrisonIcon = createIcon(Landmark, 'PrisonIcon');
export const ShuffleIcon = createIcon(Shuffle, 'ShuffleIcon');
export const HourglassIcon = createIcon(Hourglass, 'HourglassIcon');
export const MedalIcon = createIcon(Medal, 'MedalIcon');
export const MapPinIcon = createIcon(MapPin, 'MapPinIcon');
export const DollarIcon = createIcon(CircleDollarSign, 'DollarIcon');
export const ClipboardIcon = createIcon(ClipboardList, 'ClipboardIcon');
export const SkullIcon = createIcon(Skull, 'SkullIcon');
export const PartyIcon = createIcon(PartyPopper, 'PartyIcon');
export const BanknoteIcon = createIcon(Banknote, 'BanknoteIcon');
export const DepositIcon = createIcon(ArrowDownToLine, 'DepositIcon');
export const WithdrawIcon = createIcon(ArrowUpFromLine, 'WithdrawIcon');
export const MobileIcon = createIcon(Smartphone, 'MobileIcon');
export const OnlineIcon = createIcon(Circle, 'OnlineIcon');
export const SparklesIcon = createIcon(Sparkles, 'SparklesIcon');
export const ShopIcon = createIcon(Store, 'ShopIcon');
export const BuildIcon = createIcon(Construction, 'BuildIcon');
export const QuestionIcon = createIcon(HelpCircle, 'QuestionIcon');

/** Centered icon wrapper for stat cards and empty states */
export function IconBox({
  children,
  size = '1.5rem',
  color,
}: {
  children: React.ReactNode;
  size?: string | number;
  color?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: typeof size === 'number' ? undefined : size,
        color: color ?? 'var(--text-secondary)',
        marginBottom: '0.4rem',
      }}
    >
      {children}
    </div>
  );
}

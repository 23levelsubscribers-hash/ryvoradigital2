import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Ticket,
  ShieldCheck,
  Settings,
  ArrowLeft,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Search,
  DollarSign,
  TrendingUp,
  Users,
  Clock,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Copy,
  AlertCircle,
  Eye,
  EyeOff,
  Ban,
  XCircle,
  CheckCircle2,
  ShieldAlert,
  KeyRound,
  Mail,
  Lock,
  Send,
  Compass,
  FileText,
  CheckCheck,
  RotateCcw,
} from 'lucide-react';
import { Product, CustomerOrder, CustomerReview, LiveActivation, PromoCoupon, CategoryId } from '../../types';
import { RyvoraLogo } from '../RyvoraLogo';
import { CATEGORIES } from '../../data/products';
import {
  apiGetOrders,
  apiUpdateOrder,
  apiDeleteOrder,
  apiUpdateProduct,
  apiCreateProduct,
  apiDeleteProduct,
  apiCreateCoupon,
  apiToggleCoupon,
  apiDeleteCoupon,
  apiAddActivation,
  apiDeleteActivation,
  apiUpdateAnnouncement,
} from '../../utils/api';
import { firestoreSubscribeOrders, firestoreUpdateOrder, firestoreDeleteOrder } from '../../lib/firebase';

interface AdminDashboardProps {
  products: Product[];
  onUpdateProducts: (products: Product[]) => void;
  orders: CustomerOrder[];
  onUpdateOrders: (orders: CustomerOrder[]) => void;
  reviews: CustomerReview[];
  onUpdateReviews: (reviews: CustomerReview[]) => void;
  activations: LiveActivation[];
  onUpdateActivations: (activations: LiveActivation[]) => void;
  coupons: PromoCoupon[];
  onUpdateCoupons: (coupons: PromoCoupon[]) => void;
  onExitAdmin: () => void;
  announcementText: string;
  onUpdateAnnouncement: (text: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  products,
  onUpdateProducts,
  orders,
  onUpdateOrders,
  reviews,
  onUpdateReviews,
  activations,
  onUpdateActivations,
  coupons,
  onUpdateCoupons,
  onExitAdmin,
  announcementText,
  onUpdateAnnouncement,
}) => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'products' | 'orders' | 'coupons' | 'proofs' | 'settings'>('analytics');
  
  // Product search & edit
  const [productSearch, setProductSearch] = useState('');
  const [productCatFilter, setProductCatFilter] = useState<CategoryId>('all');
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);

  // New Product Form state
  const [newName, setNewName] = useState('');
  const [newTagline, setNewTagline] = useState('');
  const [newCategory, setNewCategory] = useState<CategoryId>('ai');
  const [newRetailPrice, setNewRetailPrice] = useState('20.00');
  const [newPrice, setNewPrice] = useState('8.99');
  const [newFeatures, setNewFeatures] = useState('Full private account\nHigh speed priority access\nFull warranty replacement');
  const [newBrandColor, setNewBrandColor] = useState('#00E5FF');

  // New Coupon Form
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponDiscount, setNewCouponDiscount] = useState('15');
  const [newCouponDesc, setNewCouponDesc] = useState('');

  // New Live Activation Form
  const [newActProduct, setNewActProduct] = useState('ChatGPT Plus & Team');
  const [newActEmail, setNewActEmail] = useState('j****@gmail.com');
  const [newActCity, setNewActCity] = useState('New York');
  const [newActState, setNewActState] = useState('NY');
  const [newActDuration, setNewActDuration] = useState('1 Year License');

  // License & Account Dispatch Modal State
  const [dispatchOrder, setDispatchOrder] = useState<CustomerOrder | null>(null);
  const [dispatchEmail, setDispatchEmail] = useState('');
  const [dispatchPassword, setDispatchPassword] = useState('');
  const [dispatchKey, setDispatchKey] = useState('');
  const [dispatchInstructions, setDispatchInstructions] = useState('');
  const [showDispatchPassword, setShowDispatchPassword] = useState(true);

  // Decline Order Modal State
  const [decliningOrder, setDecliningOrder] = useState<CustomerOrder | null>(null);
  const [declineReasonText, setDeclineReasonText] = useState('Payment screenshot invalid or unreadable');

  // Cancel Order Modal State
  const [orderToCancel, setOrderToCancel] = useState<CustomerOrder | null>(null);

  // Delete Order Modal State
  const [orderToDelete, setOrderToDelete] = useState<CustomerOrder | null>(null);

  // Order Search & Filter State
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'processing' | 'activated' | 'delivered' | 'cancelled' | 'declined'>('all');
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});

  // Admin Tracking Preview Modal State
  const [adminTrackingOrder, setAdminTrackingOrder] = useState<CustomerOrder | null>(null);
  const [adminTrackingShowPassword, setAdminTrackingShowPassword] = useState(false);
  const [adminCopiedKey, setAdminCopiedKey] = useState<string | null>(null);

  const copyAdminText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setAdminCopiedKey(id);
    setTimeout(() => setAdminCopiedKey(null), 2000);
  };

  const [viewingProofOrder, setViewingProofOrder] = useState<CustomerOrder | null>(null);

  // Auto-refresh & notification polling state (12 seconds production interval)
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<string>('Just now');

  const refreshOrders = async () => {
    try {
      setIsRefreshing(true);
      const fresh = await apiGetOrders();
      if (fresh && fresh.length > 0) {
        onUpdateOrders(fresh);
        setLastSync(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } catch (e) {
      console.warn('Admin orders auto-refresh failed:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // 1. Initial server fetch
    refreshOrders();

    // 2. Real-time Cloud Firestore subscription: Instantly receives orders from any laptop or device
    const unsubscribeFirestore = firestoreSubscribeOrders((liveCloudOrders) => {
      if (liveCloudOrders && liveCloudOrders.length > 0) {
        console.log(`[Admin] Received ${liveCloudOrders.length} live orders from Cloud Firestore.`);
        onUpdateOrders(liveCloudOrders);
        setLastSync(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    });

    // 3. Periodic fallback poll
    const interval = setInterval(refreshOrders, 12000);
    return () => {
      unsubscribeFirestore();
      clearInterval(interval);
    };
  }, []);

  // Calculations
  const totalRevenue = orders.reduce((sum, o) => sum + o.totalUSD, 0) + 142890;
  const pendingOrders = orders.filter((o) => o.status === 'processing');
  const newOrdersCount = orders.filter((o) => (o as any).isNew || o.status === 'processing').length;

  // Filtered orders & status counts for Orders Management
  const filteredOrders = orders.filter((o) => {
    const q = orderSearchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      o.orderId.toLowerCase().includes(q) ||
      o.customerEmail.toLowerCase().includes(q) ||
      (o.customerPhone && o.customerPhone.toLowerCase().includes(q)) ||
      (o.transactionId && o.transactionId.toLowerCase().includes(q)) ||
      (o.accountEmail && o.accountEmail.toLowerCase().includes(q)) ||
      (o.credentials?.accountEmail && o.credentials.accountEmail.toLowerCase().includes(q)) ||
      (o.licenseKey && o.licenseKey.toLowerCase().includes(q)) ||
      (o.credentials?.licenseKey && o.credentials.licenseKey.toLowerCase().includes(q)) ||
      o.items.some((i) => i.product.name.toLowerCase().includes(q));

    const matchesStatus = orderStatusFilter === 'all' || o.status === orderStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    all: orders.length,
    processing: orders.filter((o) => o.status === 'processing').length,
    activated: orders.filter((o) => o.status === 'activated').length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
    declined: orders.filter((o) => o.status === 'declined').length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
  };

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.tagline.toLowerCase().includes(productSearch.toLowerCase());
    const matchesCat = productCatFilter === 'all' || p.category === productCatFilter;
    return matchesSearch && matchesCat;
  });

  // Handle Add Product
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const catObj = CATEGORIES.find((c) => c.id === newCategory);

    const newProd: Product = {
      id: `prod-${Date.now()}`,
      name: newName.trim(),
      tagline: newTagline.trim() || 'Premium Digital License Key',
      category: newCategory,
      categoryLabel: catObj ? catObj.name.toUpperCase() : 'DIGITAL TOOL',
      iconName: 'Sparkles',
      brandColor: newBrandColor,
      accentGlow: `${newBrandColor}40`,
      rating: 5.0,
      reviewsCount: 1,
      features: newFeatures.split('\n').filter((f) => f.trim().length > 0),
      retailPriceUSD: parseFloat(newRetailPrice) || 29.99,
      priceUSD: parseFloat(newPrice) || 9.99,
      inStock: true,
      popular: true,
      allowedAccountTypes: ['private_account'],
      description: `${newName} digital subscription with instant automated license provisioning and full term replacement guarantee.`,
      deliveryTime: 'Instant (2-5 mins)',
      warranty: 'Full Duration Warranty Guarantee'
    };

    onUpdateProducts([newProd, ...products]);
    setIsAddProductOpen(false);
    setNewName('');
    setNewTagline('');

    try {
      await apiCreateProduct(newProd);
    } catch (err) {
      console.error('Error saving new product to database:', err);
    }
  };

  // Toggle Stock
  const handleToggleStock = async (productId: string) => {
    const target = products.find((p) => p.id === productId);
    if (!target) return;
    const newStock = !target.inStock;

    const updated = products.map((p) =>
      p.id === productId ? { ...p, inStock: newStock } : p
    );
    onUpdateProducts(updated);

    try {
      await apiUpdateProduct(productId, { inStock: newStock });
    } catch (err) {
      console.error('Error updating stock on database:', err);
    }
  };

  // Save Inline Price
  const handleSavePrice = async (productId: string) => {
    const updated = products.map((p) =>
      p.id === productId ? { ...p, priceUSD: editPrice } : p
    );
    onUpdateProducts(updated);
    setEditingProductId(null);

    try {
      await apiUpdateProduct(productId, { priceUSD: editPrice });
    } catch (err) {
      console.error('Error saving price on database:', err);
    }
  };

  // Delete Product
  const handleDeleteProduct = async (productId: string) => {
    if (confirm('Are you sure you want to remove this product from Ryvora Digital?')) {
      onUpdateProducts(products.filter((p) => p.id !== productId));
      try {
        await apiDeleteProduct(productId);
      } catch (err) {
        console.error('Error deleting product from database:', err);
      }
    }
  };

  // Add Coupon
  const handleAddCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCouponCode.trim()) return;

    const coupon: PromoCoupon = {
      code: newCouponCode.trim().toUpperCase(),
      discountPercent: parseInt(newCouponDiscount) || 10,
      description: newCouponDesc.trim() || `${newCouponDiscount}% Discount Voucher`,
      active: true,
      usageCount: 0,
    };

    onUpdateCoupons([...coupons, coupon]);
    setNewCouponCode('');
    setNewCouponDesc('');

    try {
      await apiCreateCoupon(coupon);
    } catch (err) {
      console.error('Error creating coupon on database:', err);
    }
  };

  // Toggle Coupon
  const handleToggleCoupon = async (code: string) => {
    onUpdateCoupons(
      coupons.map((c) => (c.code === code ? { ...c, active: !c.active } : c))
    );

    try {
      await apiToggleCoupon(code);
    } catch (err) {
      console.error('Error toggling coupon on database:', err);
    }
  };

  // Delete Coupon
  const handleDeleteCoupon = async (code: string) => {
    onUpdateCoupons(coupons.filter((c) => c.code !== code));
    try {
      await apiDeleteCoupon(code);
    } catch (err) {
      console.error('Error deleting coupon from database:', err);
    }
  };

  // Add Live Activation Proof
  const handleAddActivation = async (e: React.FormEvent) => {
    e.preventDefault();
    const newAct: LiveActivation = {
      id: `act-${Date.now()}`,
      productName: newActProduct,
      category: 'USA Verified',
      customerMasked: newActEmail,
      city: newActCity,
      state: newActState,
      minutesAgo: 1,
      planDuration: newActDuration,
    };

    onUpdateActivations([newAct, ...activations]);

    try {
      await apiAddActivation(newAct);
    } catch (err) {
      console.error('Error adding activation to database:', err);
    }
  };

  // Delete Activation
  const handleDeleteActivation = async (id: string) => {
    onUpdateActivations(activations.filter((a) => a.id !== id));
    try {
      await apiDeleteActivation(id);
    } catch (err) {
      console.error('Error deleting activation from database:', err);
    }
  };

  // Open Dispatch Modal
  const handleOpenDispatchModal = (order: CustomerOrder) => {
    setDispatchOrder(order);
    setDispatchEmail(order.accountEmail || order.credentials?.accountEmail || order.customerEmail || '');
    setDispatchPassword(order.accountPassword || order.credentials?.accountPassword || '');
    setDispatchKey(
      order.licenseKey ||
      order.credentials?.licenseKey ||
      `RYV-${order.items[0]?.product.name.replace(/[^a-zA-Z]/g, '').substring(0, 4).toUpperCase() || 'PRO'}-${Math.random().toString(36).substring(2, 7).toUpperCase()}-US`
    );
    setDispatchInstructions(
      order.deliveryInstructions ||
      order.credentials?.instructions ||
      'Your account credentials and login instructions have been verified and dispatched by the administration team.'
    );
    setShowDispatchPassword(true);
  };

  // Generate strong random password
  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let generated = 'Ryv';
    for (let i = 0; i < 9; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setDispatchPassword(generated);
  };

  // Generate license key
  const handleGenerateKey = (prefix = 'RYV') => {
    const part1 = Math.random().toString(36).substring(2, 7).toUpperCase();
    const part2 = Math.random().toString(36).substring(2, 7).toUpperCase();
    setDispatchKey(`${prefix}-${part1}-${part2}-US`);
  };

  // Submit Dispatch
  const handleConfirmDispatch = async (targetStatus: 'delivered' | 'activated' = 'delivered') => {
    if (!dispatchOrder) return;
    const orderId = dispatchOrder.orderId;
    const creds = {
      accountEmail: dispatchEmail.trim() || dispatchOrder.customerEmail,
      accountPassword: dispatchPassword.trim() || undefined,
      licenseKey: dispatchKey.trim() || undefined,
      instructions: dispatchInstructions.trim() || 'Your account credentials have been verified and dispatched.',
    };

    const updated = orders.map((o) => {
      if (o.orderId === orderId) {
        return {
          ...o,
          status: targetStatus,
          credentials: creds,
          accountEmail: creds.accountEmail,
          accountPassword: creds.accountPassword,
          licenseKey: creds.licenseKey,
          deliveryInstructions: creds.instructions,
          isNew: false,
        };
      }
      return o;
    });

    onUpdateOrders(updated);
    if (adminTrackingOrder?.orderId === orderId) {
      setAdminTrackingOrder(updated.find((o) => o.orderId === orderId) || null);
    }
    setDispatchOrder(null);

    try {
      await apiUpdateOrder(orderId, {
        status: targetStatus,
        credentials: creds,
        accountEmail: creds.accountEmail,
        accountPassword: creds.accountPassword,
        licenseKey: creds.licenseKey,
        deliveryInstructions: creds.instructions,
        isNew: false,
      });
      await firestoreUpdateOrder(orderId, {
        status: targetStatus,
        credentials: creds,
        accountEmail: creds.accountEmail,
        accountPassword: creds.accountPassword,
        licenseKey: creds.licenseKey,
        deliveryInstructions: creds.instructions,
        isNew: false,
      });
    } catch (err) {
      console.error('Error dispatching order on database:', err);
    }
  };

  // Decline Order
  const handleOpenDeclineModal = (order: CustomerOrder) => {
    setDecliningOrder(order);
    setDeclineReasonText('Payment screenshot invalid or unreadable');
  };

  const handleConfirmDecline = async () => {
    if (!decliningOrder) return;
    const orderId = decliningOrder.orderId;
    const reason = declineReasonText.trim() || 'Payment could not be verified.';

    const updated = orders.map((o) => {
      if (o.orderId === orderId) {
        return {
          ...o,
          status: 'declined' as const,
          declineReason: reason,
          isNew: false,
        };
      }
      return o;
    });

    onUpdateOrders(updated);
    if (adminTrackingOrder?.orderId === orderId) {
      setAdminTrackingOrder(updated.find((o) => o.orderId === orderId) || null);
    }
    setDecliningOrder(null);

    try {
      await apiUpdateOrder(orderId, { status: 'declined', declineReason: reason, isNew: false });
      await firestoreUpdateOrder(orderId, { status: 'declined', declineReason: reason, isNew: false });
    } catch (err) {
      console.error('Error declining order on database:', err);
    }
  };

  // Cancel Order Modal Handlers
  const handleOpenCancelModal = (order: CustomerOrder) => {
    setOrderToCancel(order);
  };

  const handleConfirmCancel = async () => {
    if (!orderToCancel) return;
    const orderId = orderToCancel.orderId;

    const updated = orders.map((o) => {
      if (o.orderId === orderId) {
        return {
          ...o,
          status: 'cancelled' as const,
          isNew: false,
        };
      }
      return o;
    });

    onUpdateOrders(updated);
    if (adminTrackingOrder?.orderId === orderId) {
      setAdminTrackingOrder(updated.find((o) => o.orderId === orderId) || null);
    }
    setOrderToCancel(null);

    try {
      await apiUpdateOrder(orderId, { status: 'cancelled', isNew: false });
      await firestoreUpdateOrder(orderId, { status: 'cancelled', isNew: false });
    } catch (err) {
      console.error('Error cancelling order:', err);
    }
  };

  // Change Order Status
  const handleStatusChange = async (orderId: string, newStatus: string) => {
    const targetOrder = orders.find((o) => o.orderId === orderId);
    if (!targetOrder) return;

    if (newStatus === 'declined') {
      handleOpenDeclineModal(targetOrder);
      return;
    }
    if (newStatus === 'cancelled') {
      handleOpenCancelModal(targetOrder);
      return;
    }
    if (newStatus === 'delivered' && !targetOrder.accountEmail && !targetOrder.credentials?.accountEmail) {
      handleOpenDispatchModal(targetOrder);
      return;
    }

    const updated = orders.map((o) =>
      o.orderId === orderId ? { ...o, status: newStatus as any, isNew: false } : o
    );
    onUpdateOrders(updated);
    if (adminTrackingOrder?.orderId === orderId) {
      setAdminTrackingOrder(updated.find((o) => o.orderId === orderId) || null);
    }

    try {
      await apiUpdateOrder(orderId, { status: newStatus, isNew: false });
      await firestoreUpdateOrder(orderId, { status: newStatus as any, isNew: false });
    } catch (err) {
      console.error('Error updating order status on database:', err);
    }
  };

  // Delete Order permanently Modal Handlers
  const handleOpenDeleteModal = (order: CustomerOrder) => {
    setOrderToDelete(order);
  };

  const handleConfirmDelete = async () => {
    if (!orderToDelete) return;
    const orderId = orderToDelete.orderId;

    onUpdateOrders(orders.filter((o) => o.orderId !== orderId));
    if (adminTrackingOrder?.orderId === orderId) {
      setAdminTrackingOrder(null);
    }
    setOrderToDelete(null);

    try {
      await Promise.all([
        apiDeleteOrder(orderId),
        firestoreDeleteOrder(orderId),
      ]);
    } catch (err) {
      console.error('Error deleting order on database:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#06080e] text-slate-100 flex flex-col font-sans">
      
      {/* Top Admin Bar */}
      <header className="sticky top-0 z-40 bg-[#090d16]/95 border-b border-cyan-500/20 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <RyvoraLogo size="sm" showText={true} />
          
          <div className="h-6 w-px bg-slate-800 hidden sm:block" />
          
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-bold font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>LIVE CLOUD BACKEND · {orders.length} ORDERS SYNCED</span>
          </div>

          {newOrdersCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-black animate-pulse">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              <span>{newOrdersCount} NEW ORDER{newOrdersCount > 1 ? 'S' : ''}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={refreshOrders}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer transition-colors"
            title={`Last synced: ${lastSync}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
            <span className="hidden sm:inline">{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>

          <button
            onClick={onExitAdmin}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:brightness-110 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 font-bold" />
            <span>View Live Customer Storefront</span>
          </button>
        </div>
      </header>

      {/* Main Admin Body */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 flex flex-col md:flex-row gap-8">
        
        {/* Admin Navigation Sidebar */}
        <aside className="w-full md:w-64 shrink-0 space-y-2">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-2 font-mono">
            Management Modules
          </div>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
              activeTab === 'analytics'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Overview & Analytics</span>
          </button>

          <button
            onClick={() => setActiveTab('products')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
              activeTab === 'products'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Package className="w-4 h-4" />
              <span>Products & Catalog</span>
            </div>
            <span className="text-[11px] opacity-80">{products.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
              activeTab === 'orders'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-4 h-4" />
              <span>Customer Orders</span>
            </div>
            {newOrdersCount > 0 ? (
              <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black animate-pulse">
                {newOrdersCount} NEW
              </span>
            ) : (
              <span className="text-[11px] opacity-80">{orders.length}</span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('coupons')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
              activeTab === 'coupons'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Ticket className="w-4 h-4" />
              <span>Coupons & Promos</span>
            </div>
            <span className="text-[11px] opacity-80">{coupons.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('proofs')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
              activeTab === 'proofs'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-4 h-4" />
              <span>Proofs & Reviews</span>
            </div>
            <span className="text-[11px] opacity-80">{activations.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Store Configuration</span>
          </button>

          <div className="pt-6 border-t border-slate-900 mt-6">
            <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div>Store Server: <strong className="text-emerald-400">Online</strong></div>
              <div>License Auto-Bot: <strong className="text-cyan-400">Active</strong></div>
              <div>US Gateway: <strong className="text-slate-200">Stripe Live</strong></div>
            </div>
          </div>
        </aside>

        {/* Content Panel */}
        <main className="flex-1 min-w-0">
          
          {/* TAB 1: ANALYTICS OVERVIEW */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-black text-white font-display">Store Performance & Revenue</h2>
                <p className="text-xs text-slate-400 mt-0.5">Live North American sales telemetry and active key activations.</p>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-[#090d16] border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-semibold">Total Gross Volume</span>
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-black text-white font-display tabular-nums">
                    ${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-emerald-400 font-semibold mt-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> +28.4% this month
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-[#090d16] border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-semibold">Active Subscriptions</span>
                    <Users className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="text-2xl font-black text-white font-display tabular-nums">
                    4,850+
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Across US, Canada & Global
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-[#090d16] border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-semibold">Catalog Items</span>
                    <Package className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-2xl font-black text-white font-display tabular-nums">
                    {products.length} Active
                  </div>
                  <div className="text-[11px] text-purple-400 font-semibold mt-1">
                    100% In Stock Available
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-[#090d16] border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-semibold">Fulfillment Speed</span>
                    <Clock className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-black text-white font-display tabular-nums">
                    ~90s Avg
                  </div>
                  <div className="text-[11px] text-emerald-400 font-semibold mt-1">
                    Automated Email Dispatch
                  </div>
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="p-6 rounded-3xl bg-[#090d16] border border-slate-800">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 font-display">
                  Category Revenue Share
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
                    <div className="text-slate-400 font-semibold mb-1">AI Tools</div>
                    <div className="text-lg font-bold text-cyan-400">48.2%</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">ChatGPT, Claude, Cursor</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
                    <div className="text-slate-400 font-semibold mb-1">Design & Creative</div>
                    <div className="text-lg font-bold text-emerald-400">26.5%</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Adobe CC, Canva, Figma</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
                    <div className="text-slate-400 font-semibold mb-1">Video & Audio</div>
                    <div className="text-lg font-bold text-purple-400">14.1%</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">ElevenLabs, CapCut, HeyGen</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
                    <div className="text-slate-400 font-semibold mb-1">Streaming & VPNs</div>
                    <div className="text-lg font-bold text-amber-400">11.2%</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Netflix 4K, Spotify, NordVPN</div>
                  </div>
                </div>
              </div>

              {/* Recent Orders Overview */}
              <div className="p-6 rounded-3xl bg-[#090d16] border border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-display">
                    Recent Orders Log
                  </h3>
                  <button
                    onClick={() => setActiveTab('orders')}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                  >
                    View All Orders →
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead>
                      <tr className="border-b border-slate-800 text-[11px] uppercase font-bold text-slate-500">
                        <th className="pb-3">Order ID</th>
                        <th className="pb-3">Customer Email</th>
                        <th className="pb-3">Items</th>
                        <th className="pb-3">Total</th>
                        <th className="pb-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {orders.slice(0, 5).map((ord) => (
                        <tr key={ord.orderId} className="hover:bg-slate-900/40">
                          <td className="py-3 font-mono text-cyan-400 font-bold">{ord.orderId}</td>
                          <td className="py-3">{ord.customerEmail}</td>
                          <td className="py-3 font-medium text-white">{ord.items.map((i) => i.product.name).join(', ')}</td>
                          <td className="py-3 font-bold text-emerald-400 tabular-nums">${ord.totalUSD.toFixed(2)}</td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold text-[10px]">
                              {ord.status.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRODUCTS & CATALOG MANAGEMENT */}
          {activeTab === 'products' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-white font-display">Catalog & Inventory</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Control product prices, stock status, and add new services.</p>
                </div>

                <button
                  onClick={() => setIsAddProductOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer shadow-md self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4 font-bold" />
                  <span>Add New Digital Tool</span>
                </button>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by tool name or description..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <select
                  value={productCatFilter}
                  onChange={(e) => setProductCatFilter(e.target.value as CategoryId)}
                  className="bg-slate-900 border border-slate-800 text-xs text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="all">All Categories ({products.length})</option>
                  {CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Products Table */}
              <div className="rounded-3xl bg-[#090d16] border border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] uppercase font-bold text-slate-500">
                        <th className="p-4">Product Name</th>
                        <th className="p-4">Category</th>
                        <th className="p-4">Retail Price</th>
                        <th className="p-4">Ryvora Price (USD)</th>
                        <th className="p-4">Stock Status</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredProducts.map((p) => {
                        const isEditingThis = editingProductId === p.id;
                        return (
                          <tr key={p.id} className="hover:bg-slate-900/30">
                            <td className="p-4 font-bold text-white flex items-center gap-3">
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-extrabold text-xs shrink-0"
                                style={{ backgroundColor: p.brandColor }}
                              >
                                {p.name.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <span>{p.name}</span>
                                <span className="block text-[11px] font-normal text-slate-500 line-clamp-1">{p.tagline}</span>
                              </div>
                            </td>

                            <td className="p-4 font-mono text-[11px] text-cyan-400">
                              {p.categoryLabel}
                            </td>

                            <td className="p-4 text-slate-500 line-through tabular-nums">
                              ${p.retailPriceUSD.toFixed(2)}
                            </td>

                            {/* Price (Editable) */}
                            <td className="p-4 tabular-nums">
                              {isEditingThis ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    step="0.5"
                                    value={editPrice}
                                    onChange={(e) => setEditPrice(parseFloat(e.target.value) || 0)}
                                    className="w-20 px-2 py-1 rounded bg-slate-950 border border-cyan-500 text-xs font-bold text-white focus:outline-none"
                                  />
                                  <button
                                    onClick={() => handleSavePrice(p.id)}
                                    className="p-1 rounded bg-emerald-500 text-slate-950 cursor-pointer"
                                    title="Save price"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setEditingProductId(null)}
                                    className="p-1 rounded bg-slate-800 text-slate-400 cursor-pointer"
                                    title="Cancel"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditingProductId(p.id);
                                    setEditPrice(p.priceUSD);
                                  }}
                                  className="group font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 cursor-pointer"
                                  title="Click to edit price"
                                >
                                  <span>${p.priceUSD.toFixed(2)}</span>
                                  <Edit2 className="w-3 h-3 text-slate-600 group-hover:text-cyan-400 transition-colors" />
                                </button>
                              )}
                            </td>

                            {/* In Stock Toggle */}
                            <td className="p-4">
                              <button
                                onClick={() => handleToggleStock(p.id)}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                                  p.inStock
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                }`}
                              >
                                {p.inStock ? '● IN STOCK' : '○ OUT OF STOCK'}
                              </button>
                            </td>

                            {/* Actions */}
                            <td className="p-4 text-right">
                              <button
                                onClick={() => handleDeleteProduct(p.id)}
                                className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                title="Remove Product"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Add Product Modal */}
              {isAddProductOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                  <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#090d16] border border-cyan-500/30 p-6 sm:p-8 shadow-2xl">
                    <button
                      onClick={() => setIsAddProductOpen(false)}
                      className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white bg-slate-900 border border-slate-800 transition-colors cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>

                    <h3 className="text-xl font-bold text-white font-display mb-1">
                      Add New Digital Tool
                    </h3>
                    <p className="text-xs text-slate-400 mb-5">
                      Publish a new software subscription or license to the USA storefront.
                    </p>

                    <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">Tool Name</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. GitHub Copilot Enterprise"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">Tagline / Short Hook</label>
                        <input
                          type="text"
                          placeholder="e.g. Next-Gen AI Code Pair Programmer"
                          value={newTagline}
                          onChange={(e) => setNewTagline(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-300 font-semibold mb-1">Category</label>
                          <select
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value as CategoryId)}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                          >
                            <option value="ai">AI Tools</option>
                            <option value="design">Design & Graphics</option>
                            <option value="video">Video Editing</option>
                            <option value="development">Developer Tools</option>
                            <option value="streaming">Streaming & Entertainment</option>
                            <option value="marketing">Marketing & SEO</option>
                            <option value="vpn">VPNs & Security</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-300 font-semibold mb-1">Brand Theme Color</label>
                          <input
                            type="color"
                            value={newBrandColor}
                            onChange={(e) => setNewBrandColor(e.target.value)}
                            className="w-full h-9 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-300 font-semibold mb-1">Official Retail Price ($ USD)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={newRetailPrice}
                            onChange={(e) => setNewRetailPrice(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-300 font-semibold mb-1">Ryvora Discount Price ($ USD)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={newPrice}
                            onChange={(e) => setNewPrice(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">Features (One per line)</label>
                        <textarea
                          rows={3}
                          value={newFeatures}
                          onChange={(e) => setNewFeatures(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      <div className="pt-2 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setIsAddProductOpen(false)}
                          className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold cursor-pointer"
                        >
                          Publish to Store
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CUSTOMER ORDERS & KEY DISPATCH */}
          {activeTab === 'orders' && (
            <div className="space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-white font-display">Customer Orders & License Dispatch</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Manage orders, dispatch account credentials (Email & Password), track live delivery, and cancel/decline/delete orders.</p>
                </div>

                {/* Search Bar */}
                <div className="flex items-center gap-2">
                  <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search Order ID, Email, Key, Ref..."
                      value={orderSearchQuery}
                      onChange={(e) => setOrderSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                    />
                    {orderSearchQuery && (
                      <button
                        onClick={() => setOrderSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
                {(['all', 'processing', 'delivered', 'activated', 'declined', 'cancelled'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setOrderStatusFilter(filter)}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                      orderStatusFilter === filter
                        ? 'bg-cyan-500 text-slate-950 shadow-md font-extrabold'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    <span className="capitalize">{filter === 'all' ? 'All Orders' : filter}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      orderStatusFilter === filter ? 'bg-slate-950 text-cyan-300 font-bold' : 'bg-slate-800 text-slate-300'
                    }`}>
                      {statusCounts[filter]}
                    </span>
                  </button>
                ))}
              </div>

              <div className="rounded-3xl bg-[#090d16] border border-slate-800 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] uppercase font-bold text-slate-500">
                        <th className="p-4">Order ID & Date</th>
                        <th className="p-4">Customer Contact</th>
                        <th className="p-4">Payment Proof</th>
                        <th className="p-4">Tools Purchased</th>
                        <th className="p-4">Payment Method</th>
                        <th className="p-4">Total</th>
                        <th className="p-4">Status & Dispatched Credentials</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredOrders.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-12 text-center text-slate-500">
                            <div className="max-w-sm mx-auto space-y-2">
                              <ShoppingBag className="w-10 h-10 mx-auto text-slate-700" />
                              <p className="font-semibold text-slate-400 text-sm">No orders matching your criteria</p>
                              <p className="text-xs text-slate-500">
                                {orderSearchQuery ? `No results for "${orderSearchQuery}" in ${orderStatusFilter} orders.` : 'No orders in this status category.'}
                              </p>
                              {(orderSearchQuery || orderStatusFilter !== 'all') && (
                                <button
                                  onClick={() => {
                                    setOrderSearchQuery('');
                                    setOrderStatusFilter('all');
                                  }}
                                  className="mt-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-semibold cursor-pointer"
                                >
                                  Clear Filters
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredOrders.map((ord) => (
                          <tr key={ord.orderId} className={`hover:bg-slate-900/30 ${(ord as any).isNew ? 'bg-cyan-950/20' : ''}`}>
                            <td className="p-4">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="font-mono text-cyan-400 font-bold block">{ord.orderId}</span>
                                {((ord as any).isNew || ord.status === 'processing') && (
                                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
                                    NEW
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-500">{ord.createdAt}</span>
                            </td>

                            <td className="p-4">
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-white">{ord.customerEmail}</span>
                                <button
                                  onClick={() => copyAdminText(ord.customerEmail, `email-${ord.orderId}`)}
                                  className="text-slate-500 hover:text-cyan-400 p-0.5 cursor-pointer"
                                  title="Copy Email"
                                >
                                  {adminCopiedKey === `email-${ord.orderId}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </div>
                              {ord.customerPhone && (
                                <span className="block text-[10px] text-slate-400 font-mono mt-0.5">{ord.customerPhone}</span>
                              )}
                            </td>

                            <td className="p-4">
                              {ord.paymentProof ? (
                                <div className="flex items-center gap-2">
                                  <img
                                    src={ord.paymentProof}
                                    alt="Proof Screenshot"
                                    onClick={() => setViewingProofOrder(ord)}
                                    className="w-12 h-12 object-cover rounded-lg border border-slate-700 hover:border-cyan-400 cursor-pointer shadow-sm hover:scale-105 transition-transform"
                                    title="Click to view full screenshot"
                                  />
                                  <div className="text-[10px]">
                                    <button
                                      onClick={() => setViewingProofOrder(ord)}
                                      className="text-cyan-400 hover:text-cyan-300 font-semibold block cursor-pointer"
                                    >
                                      View Proof
                                    </button>
                                    {ord.transactionId && (
                                      <span className="text-slate-400 font-mono block truncate max-w-[100px]" title={ord.transactionId}>
                                        Ref: {ord.transactionId}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-500 italic">No receipt attached</span>
                              )}
                            </td>

                            <td className="p-4">
                              <div className="space-y-1">
                                {ord.items.map((i, idx) => (
                                  <div key={idx} className="font-semibold text-slate-200">
                                    {i.product.name} ({i.duration.replace('_', ' ')})
                                  </div>
                                ))}
                              </div>
                            </td>

                            <td className="p-4 text-slate-400">
                              {ord.paymentMethod}
                            </td>

                            <td className="p-4 font-bold text-emerald-400 tabular-nums">
                              ${ord.totalUSD.toFixed(2)}
                            </td>

                            <td className="p-4">
                              <div className="flex flex-col gap-1.5 min-w-[190px]">
                                <select
                                  value={ord.status}
                                  onChange={(e) => handleStatusChange(ord.orderId, e.target.value)}
                                  className={`text-[10px] font-bold px-2 py-1 rounded-lg border bg-slate-900 cursor-pointer focus:outline-none ${
                                    ord.status === 'delivered'
                                      ? 'text-emerald-400 border-emerald-500/40 bg-emerald-950/20'
                                      : ord.status === 'activated'
                                      ? 'text-cyan-300 border-cyan-500/40 bg-cyan-950/20'
                                      : ord.status === 'declined'
                                      ? 'text-rose-400 border-rose-500/40 bg-rose-950/20'
                                      : ord.status === 'cancelled'
                                      ? 'text-slate-400 border-slate-700 bg-slate-900'
                                      : 'text-amber-300 border-amber-500/40 bg-amber-950/20'
                                  }`}
                                >
                                  <option value="processing">PROCESSING</option>
                                  <option value="activated">ACTIVATED</option>
                                  <option value="delivered">DELIVERED</option>
                                  <option value="cancelled">CANCELLED</option>
                                  <option value="declined">DECLINED</option>
                                </select>

                                {/* Allocated Credentials Badges (Email & Password) */}
                                <div className="space-y-1 text-[10px] bg-slate-950/60 p-2 rounded-xl border border-slate-800/80">
                                  {/* Dispatched Email */}
                                  {(ord.accountEmail || ord.credentials?.accountEmail) ? (
                                    <div className="flex items-center justify-between text-slate-300" title={ord.accountEmail || ord.credentials?.accountEmail}>
                                      <div className="flex items-center gap-1 truncate max-w-[130px]">
                                        <Mail className="w-3 h-3 text-cyan-400 shrink-0" />
                                        <span className="truncate font-mono">{ord.accountEmail || ord.credentials?.accountEmail}</span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => copyAdminText(ord.accountEmail || ord.credentials?.accountEmail || '', `acc-email-${ord.orderId}`)}
                                        className="text-slate-500 hover:text-cyan-400 p-0.5 cursor-pointer ml-1"
                                        title="Copy Account Email"
                                      >
                                        {adminCopiedKey === `acc-email-${ord.orderId}` ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="text-slate-500 text-[9px] italic flex items-center gap-1">
                                      <Mail className="w-2.5 h-2.5 text-slate-600 shrink-0" />
                                      <span>Email not yet given</span>
                                    </div>
                                  )}

                                  {/* Dispatched Password */}
                                  {(ord.accountPassword || ord.credentials?.accountPassword) ? (
                                    <div className="flex items-center justify-between text-amber-300 font-mono">
                                      <div className="flex items-center gap-1">
                                        <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                                        <span className="select-all">
                                          {revealedPasswords[ord.orderId]
                                            ? (ord.accountPassword || ord.credentials?.accountPassword)
                                            : '••••••••'}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-0.5">
                                        <button
                                          type="button"
                                          onClick={() => setRevealedPasswords((prev) => ({ ...prev, [ord.orderId]: !prev[ord.orderId] }))}
                                          className="text-slate-500 hover:text-amber-300 p-0.5 cursor-pointer"
                                          title={revealedPasswords[ord.orderId] ? 'Hide Password' : 'Show Password'}
                                        >
                                          {revealedPasswords[ord.orderId] ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => copyAdminText(ord.accountPassword || ord.credentials?.accountPassword || '', `acc-pass-${ord.orderId}`)}
                                          className="text-slate-500 hover:text-amber-300 p-0.5 cursor-pointer"
                                          title="Copy Account Password"
                                        >
                                          {adminCopiedKey === `acc-pass-${ord.orderId}` ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-slate-500 text-[9px] italic flex items-center gap-1">
                                      <Lock className="w-2.5 h-2.5 text-slate-600 shrink-0" />
                                      <span>Password not yet given</span>
                                    </div>
                                  )}

                                  {/* License Key */}
                                  {(ord.licenseKey || ord.credentials?.licenseKey) && (
                                    <div className="flex items-center justify-between text-emerald-400 font-mono text-[9px]" title={ord.licenseKey || ord.credentials?.licenseKey}>
                                      <div className="flex items-center gap-1 truncate max-w-[130px]">
                                        <KeyRound className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                                        <span className="truncate">{ord.licenseKey || ord.credentials?.licenseKey}</span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => copyAdminText(ord.licenseKey || ord.credentials?.licenseKey || '', `key-${ord.orderId}`)}
                                        className="text-slate-500 hover:text-emerald-300 p-0.5 cursor-pointer ml-1"
                                        title="Copy Key"
                                      >
                                        {adminCopiedKey === `key-${ord.orderId}` ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                                      </button>
                                    </div>
                                  )}

                                  {/* Decline Reason */}
                                  {ord.declineReason && ord.status === 'declined' && (
                                    <div className="text-[9px] text-rose-400 leading-tight pt-0.5 border-t border-rose-500/20">
                                      <strong>Declined:</strong> {ord.declineReason}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                {/* 1. Track Order Button */}
                                <button
                                  onClick={() => setAdminTrackingOrder(ord)}
                                  className="px-2.5 py-1.5 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 text-cyan-300 hover:text-white font-semibold text-[11px] cursor-pointer shadow-sm flex items-center gap-1 transition-colors"
                                  title="Track live status and customer tracking preview"
                                >
                                  <Compass className="w-3.5 h-3.5 text-cyan-400" />
                                  <span>Track</span>
                                </button>

                                {/* 2. Dispatch / Edit Credentials Button (Email & Password) */}
                                <button
                                  onClick={() => handleOpenDispatchModal(ord)}
                                  className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] cursor-pointer shadow-sm flex items-center gap-1 transition-colors ${
                                    ord.status === 'delivered'
                                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                                  }`}
                                  title={ord.status === 'delivered' ? 'Edit credentials & password' : 'Enter email, password and dispatch credentials'}
                                >
                                  <Send className="w-3.5 h-3.5" />
                                  <span>{ord.status === 'delivered' ? 'Edit Credentials' : 'Dispatch'}</span>
                                </button>

                                {/* 3. Decline Order Button */}
                                {ord.status !== 'declined' && (
                                  <button
                                    onClick={() => handleOpenDeclineModal(ord)}
                                    className="p-1.5 text-rose-400 hover:text-white hover:bg-rose-500/20 border border-rose-500/30 rounded-lg transition-colors cursor-pointer"
                                    title="Decline / Reject Order"
                                  >
                                    <Ban className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {/* 4. Cancel Order Button */}
                                {ord.status !== 'cancelled' && (
                                  <button
                                    onClick={() => handleOpenCancelModal(ord)}
                                    className="p-1.5 text-amber-400 hover:text-white hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-colors cursor-pointer"
                                    title="Cancel Order"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {/* 5. Delete Order Button */}
                                <button
                                  onClick={() => handleOpenDeleteModal(ord)}
                                  className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                  title="Permanently Delete Order"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Full Payment Screenshot Viewer Modal */}
              {viewingProofOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
                  <div className="fixed inset-0" onClick={() => setViewingProofOrder(null)} />
                  <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#090d16] border border-cyan-500/40 p-6 shadow-2xl z-10">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                      <div>
                        <h3 className="text-base font-bold text-white font-display">
                          Payment Screenshot Proof - {viewingProofOrder.orderId}
                        </h3>
                        <p className="text-xs text-slate-400">
                          Customer: <strong className="text-cyan-300 font-mono">{viewingProofOrder.customerEmail}</strong> | Total: <strong className="text-emerald-400">${viewingProofOrder.totalUSD.toFixed(2)}</strong> ({viewingProofOrder.paymentMethod})
                        </p>
                        {viewingProofOrder.transactionId && (
                          <p className="text-xs text-amber-300 font-mono mt-0.5">
                            Customer Ref / TxID: {viewingProofOrder.transactionId}
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => setViewingProofOrder(null)}
                        className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {viewingProofOrder.paymentProof && (
                      <div className="bg-slate-950 p-2 rounded-2xl border border-slate-800 flex items-center justify-center overflow-hidden mb-4">
                        <img
                          src={viewingProofOrder.paymentProof}
                          alt="Customer Payment Receipt"
                          className="max-h-[60vh] w-auto object-contain rounded-xl"
                        />
                      </div>
                    )}

                    <div className="flex justify-between items-center text-xs">
                      <button
                        onClick={() => {
                          const ord = viewingProofOrder;
                          setViewingProofOrder(null);
                          setAdminTrackingOrder(ord);
                        }}
                        className="px-4 py-2 rounded-xl bg-cyan-950 border border-cyan-500/40 text-cyan-300 hover:text-white font-semibold cursor-pointer flex items-center gap-1.5"
                      >
                        <Compass className="w-4 h-4" />
                        <span>Track Order View</span>
                      </button>

                      <div className="flex gap-2">
                        <button
                          onClick={() => setViewingProofOrder(null)}
                          className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 cursor-pointer"
                        >
                          Close
                        </button>
                        <button
                          onClick={() => {
                            const ord = viewingProofOrder;
                            setViewingProofOrder(null);
                            handleOpenDispatchModal(ord);
                          }}
                          className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold cursor-pointer flex items-center gap-1.5"
                        >
                          <Send className="w-4 h-4" />
                          <span>Dispatch Credentials</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* MODAL 1: DISPATCH CREDENTIALS & EMAIL / PASSWORD MODAL */}
              {dispatchOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
                  <div className="fixed inset-0" onClick={() => setDispatchOrder(null)} />
                  <div className="relative w-full max-w-lg rounded-3xl bg-[#090d16] border border-cyan-500/40 p-6 sm:p-7 shadow-2xl z-10 max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                      <div>
                        <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
                          <Send className="w-4 h-4 text-cyan-400" />
                          <span>Dispatch Credentials & Account Details</span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Order: <span className="font-mono text-cyan-400 font-bold">{dispatchOrder.orderId}</span> · Customer: <span className="text-slate-300">{dispatchOrder.customerEmail}</span>
                        </p>
                      </div>
                      <button
                        onClick={() => setDispatchOrder(null)}
                        className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Order summary chip */}
                    <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 mb-4 text-xs space-y-1">
                      <div className="text-slate-300 font-medium flex justify-between">
                        <span>Items: {dispatchOrder.items.map((i) => `${i.product.name} (${i.duration.replace('_', ' ')})`).join(', ')}</span>
                        <strong className="text-emerald-400">${dispatchOrder.totalUSD.toFixed(2)}</strong>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center justify-between">
                        <span>Payment: {dispatchOrder.paymentMethod}</span>
                        {dispatchOrder.paymentProof && (
                          <button
                            type="button"
                            onClick={() => setViewingProofOrder(dispatchOrder)}
                            className="text-cyan-400 hover:underline cursor-pointer"
                          >
                            View Screenshot Receipt
                          </button>
                        )}
                      </div>
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleConfirmDispatch('delivered');
                      }}
                      className="space-y-3.5 text-xs"
                    >
                      {/* 1. Account Email */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Account Email / Login Username:</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setDispatchEmail(dispatchOrder.customerEmail)}
                            className="text-[10px] text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                          >
                            Use Customer Email
                          </button>
                        </div>
                        <input
                          type="text"
                          required
                          value={dispatchEmail}
                          onChange={(e) => setDispatchEmail(e.target.value)}
                          placeholder="e.g. customer@gmail.com or pro-seat-92@ryvoradigital.com"
                          className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      {/* 2. Account Password */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-amber-400" />
                            <span>Account Password:</span>
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setShowDispatchPassword(!showDispatchPassword)}
                              className="text-[10px] text-slate-400 hover:text-cyan-400 flex items-center gap-1 cursor-pointer"
                            >
                              {showDispatchPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              <span>{showDispatchPassword ? 'Hide' : 'Show'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleGeneratePassword}
                              className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold underline cursor-pointer flex items-center gap-0.5"
                            >
                              <Sparkles className="w-2.5 h-2.5" />
                              <span>Auto-Gen Password</span>
                            </button>
                          </div>
                        </div>
                        <input
                          type={showDispatchPassword ? 'text' : 'password'}
                          value={dispatchPassword}
                          onChange={(e) => setDispatchPassword(e.target.value)}
                          placeholder="e.g. RyvSecure#9821 or leave blank if activation via invite"
                          className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      {/* 3. License Key */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                            <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                            <span>License Key / Token / Invitation Link:</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => handleGenerateKey()}
                            className="text-[10px] text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                          >
                            Auto-Gen Key
                          </button>
                        </div>
                        <input
                          type="text"
                          value={dispatchKey}
                          onChange={(e) => setDispatchKey(e.target.value)}
                          placeholder="e.g. RYV-GPT4O-PRO-94821-US"
                          className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      {/* 4. Instructions */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                            <span>Activation & Login Instructions:</span>
                          </label>
                          <div className="flex items-center gap-1.5 text-[10px]">
                            <button
                              type="button"
                              onClick={() => setDispatchInstructions('Login directly using the Email & Password provided above. Do not alter billing settings or change registered email.')}
                              className="text-slate-400 hover:text-white underline cursor-pointer"
                            >
                              Private Login
                            </button>
                            <span className="text-slate-600">·</span>
                            <button
                              type="button"
                              onClick={() => setDispatchInstructions('Your account has been granted team membership seat. Accept the email invite sent to your inbox to begin.')}
                              className="text-slate-400 hover:text-white underline cursor-pointer"
                            >
                              Team Seat
                            </button>
                          </div>
                        </div>
                        <textarea
                          rows={3}
                          value={dispatchInstructions}
                          onChange={(e) => setDispatchInstructions(e.target.value)}
                          placeholder="Instructions to display on customer's live tracker and email dispatch..."
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      {/* Action buttons */}
                      <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            const o = dispatchOrder;
                            setDispatchOrder(null);
                            setAdminTrackingOrder(o);
                          }}
                          className="text-cyan-400 hover:text-cyan-300 text-xs flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                        >
                          <Compass className="w-3.5 h-3.5" />
                          <span>Track This Order</span>
                        </button>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                          <button
                            type="button"
                            onClick={() => setDispatchOrder(null)}
                            className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConfirmDispatch('activated')}
                            className="px-3.5 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-bold cursor-pointer"
                          >
                            Save as Activated
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold cursor-pointer shadow-md flex items-center gap-1.5"
                          >
                            <CheckCheck className="w-4 h-4" />
                            <span>Dispatch (Delivered)</span>
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* MODAL 2: DECLINE ORDER MODAL */}
              {decliningOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
                  <div className="fixed inset-0" onClick={() => setDecliningOrder(null)} />
                  <div className="relative w-full max-w-md rounded-3xl bg-[#090d16] border border-rose-500/40 p-6 shadow-2xl z-10">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                          <Ban className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-white font-display">Decline Customer Order</h3>
                          <p className="text-xs text-slate-400">Order: <span className="font-mono text-cyan-400 font-bold">{decliningOrder.orderId}</span></p>
                        </div>
                      </div>
                      <button
                        onClick={() => setDecliningOrder(null)}
                        className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/20 text-xs text-rose-300 mb-4">
                      Declining will update the order status to <strong className="text-rose-400">DECLINED</strong> across all devices and display the reason to the customer on their tracker.
                    </div>

                    <div className="space-y-3 text-xs mb-5">
                      <label className="block text-[11px] font-semibold text-slate-300">
                        Select Reason for Declining:
                      </label>

                      {/* Quick reason chips */}
                      <div className="space-y-1.5">
                        {[
                          'Payment screenshot invalid or unreadable',
                          'Payment not received in bank/wallet account',
                          'Incorrect transfer amount paid',
                          'Product subscription currently out of stock',
                          'Transaction reference ID duplicate or invalid',
                        ].map((reason) => (
                          <button
                            key={reason}
                            type="button"
                            onClick={() => setDeclineReasonText(reason)}
                            className={`w-full text-left p-2 rounded-xl border text-[11px] transition-colors cursor-pointer ${
                              declineReasonText === reason
                                ? 'bg-rose-950/40 border-rose-500/60 text-rose-200'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {reason}
                          </button>
                        ))}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                          Custom Reason / Customer Note:
                        </label>
                        <textarea
                          rows={2}
                          value={declineReasonText}
                          onChange={(e) => setDeclineReasonText(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setDecliningOrder(null)}
                        className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmDecline}
                        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer shadow-md flex items-center gap-1.5"
                      >
                        <Ban className="w-4 h-4" />
                        <span>Confirm Decline Order</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* MODAL 3: ADMIN LIVE ORDER TRACKER PREVIEW MODAL */}
              {adminTrackingOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
                  <div className="fixed inset-0" onClick={() => setAdminTrackingOrder(null)} />
                  <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#090d16] border border-cyan-500/40 p-6 sm:p-7 shadow-2xl z-10">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                          <Compass className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
                            <span>Admin Order Tracker</span>
                            <span className="font-mono text-cyan-400 font-bold">({adminTrackingOrder.orderId})</span>
                          </h3>
                          <p className="text-xs text-slate-400">
                            Customer: <strong className="text-slate-200">{adminTrackingOrder.customerEmail}</strong> · Created: {adminTrackingOrder.createdAt}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => setAdminTrackingOrder(null)}
                        className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Order Status & Stepper */}
                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 mb-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase">Live Fulfillment Status:</span>
                        <span
                          className={`text-xs font-black px-3 py-1 rounded-full uppercase border ${
                            adminTrackingOrder.status === 'delivered'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                              : adminTrackingOrder.status === 'activated'
                              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                              : adminTrackingOrder.status === 'declined'
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                              : adminTrackingOrder.status === 'cancelled'
                              ? 'bg-slate-800 text-slate-400 border-slate-700'
                              : 'bg-amber-500/20 text-amber-400 border-amber-500/40 animate-pulse'
                          }`}
                        >
                          {adminTrackingOrder.status.toUpperCase()}
                        </span>
                      </div>

                      {adminTrackingOrder.declineReason && adminTrackingOrder.status === 'declined' && (
                        <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs">
                          <strong>Decline Reason:</strong> {adminTrackingOrder.declineReason}
                        </div>
                      )}

                      {/* Items */}
                      <div className="pt-2 border-t border-slate-800/80 text-xs space-y-1.5">
                        <span className="text-[11px] font-bold text-slate-400 block uppercase">Purchased Tools:</span>
                        {adminTrackingOrder.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-slate-300 bg-slate-900/60 p-2 rounded-xl">
                            <span>{item.product.name} ({item.duration.replace('_', ' ')})</span>
                            <span className="font-mono text-cyan-400">Qty: {item.quantity} · ${item.priceUSD.toFixed(2)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between items-center pt-1 text-slate-300 font-bold">
                          <span>Total Amount:</span>
                          <span className="text-emerald-400 text-sm font-mono">${adminTrackingOrder.totalUSD.toFixed(2)} USD</span>
                        </div>
                      </div>
                    </div>

                    {/* Dispatched Credentials Box */}
                    <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 mb-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
                        <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                          <KeyRound className="w-4 h-4 text-cyan-400" />
                          <span>Credentials Sent to Customer</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const o = adminTrackingOrder;
                            setAdminTrackingOrder(null);
                            handleOpenDispatchModal(o);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[10px] cursor-pointer flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" />
                          <span>Dispatch / Edit Credentials</span>
                        </button>
                      </div>

                      {/* Account Email */}
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Account Email:</span>
                        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950 font-mono text-xs text-white border border-slate-800">
                          <span className="truncate">{adminTrackingOrder.accountEmail || adminTrackingOrder.credentials?.accountEmail || 'Not yet dispatched'}</span>
                          {(adminTrackingOrder.accountEmail || adminTrackingOrder.credentials?.accountEmail) && (
                            <button
                              onClick={() => copyAdminText(adminTrackingOrder.accountEmail || adminTrackingOrder.credentials?.accountEmail || '', 'email')}
                              className="p-1 rounded text-slate-400 hover:text-cyan-400 cursor-pointer"
                              title="Copy Email"
                            >
                              {adminCopiedKey === 'email' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Account Password */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-slate-400 uppercase font-bold">Account Password:</span>
                          <button
                            onClick={() => setAdminTrackingShowPassword(!adminTrackingShowPassword)}
                            className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                          >
                            {adminTrackingShowPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            <span>{adminTrackingShowPassword ? 'Hide' : 'Show'}</span>
                          </button>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950 font-mono text-xs text-white border border-slate-800">
                          <span>
                            {adminTrackingOrder.accountPassword || adminTrackingOrder.credentials?.accountPassword
                              ? (adminTrackingShowPassword ? (adminTrackingOrder.accountPassword || adminTrackingOrder.credentials?.accountPassword) : '••••••••••••••••')
                              : 'Not yet dispatched'}
                          </span>
                          {(adminTrackingOrder.accountPassword || adminTrackingOrder.credentials?.accountPassword) && (
                            <button
                              onClick={() => copyAdminText(adminTrackingOrder.accountPassword || adminTrackingOrder.credentials?.accountPassword || '', 'pass')}
                              className="p-1 rounded text-slate-400 hover:text-cyan-400 cursor-pointer"
                              title="Copy Password"
                            >
                              {adminCopiedKey === 'pass' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* License Key */}
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">License Key:</span>
                        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950 font-mono text-xs text-cyan-400 border border-slate-800">
                          <span className="truncate">{adminTrackingOrder.licenseKey || adminTrackingOrder.credentials?.licenseKey || 'Not yet dispatched'}</span>
                          {(adminTrackingOrder.licenseKey || adminTrackingOrder.credentials?.licenseKey) && (
                            <button
                              onClick={() => copyAdminText(adminTrackingOrder.licenseKey || adminTrackingOrder.credentials?.licenseKey || '', 'key')}
                              className="p-1 rounded text-slate-400 hover:text-cyan-400 cursor-pointer"
                              title="Copy Key"
                            >
                              {adminCopiedKey === 'key' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Instructions */}
                      {(adminTrackingOrder.deliveryInstructions || adminTrackingOrder.credentials?.instructions) && (
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Instructions:</span>
                          <div className="p-2.5 rounded-xl bg-slate-950 text-xs text-slate-300 border border-slate-800 leading-relaxed whitespace-pre-wrap">
                            {adminTrackingOrder.deliveryInstructions || adminTrackingOrder.credentials?.instructions}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Receipt Screenshot Preview if any */}
                    {adminTrackingOrder.paymentProof && (
                      <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 mb-4">
                        <span className="text-[11px] font-bold text-slate-400 uppercase block mb-2">Customer Payment Proof:</span>
                        <img
                          src={adminTrackingOrder.paymentProof}
                          alt="Customer Payment Receipt"
                          className="max-h-56 w-auto object-contain rounded-xl border border-slate-800 mx-auto"
                        />
                      </div>
                    )}

                    {/* Bottom Modal Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-800 text-xs">
                      <div className="flex items-center gap-2">
                        {adminTrackingOrder.status !== 'declined' && (
                          <button
                            type="button"
                            onClick={() => {
                              const o = adminTrackingOrder;
                              setAdminTrackingOrder(null);
                              handleOpenDeclineModal(o);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-semibold cursor-pointer flex items-center gap-1"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Decline Order</span>
                          </button>
                        )}
                        {adminTrackingOrder.status !== 'cancelled' && (
                          <button
                            type="button"
                            onClick={() => {
                              const o = adminTrackingOrder;
                              setAdminTrackingOrder(null);
                              handleOpenCancelModal(o);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-semibold cursor-pointer flex items-center gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Cancel Order</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            const o = adminTrackingOrder;
                            setAdminTrackingOrder(null);
                            handleOpenDeleteModal(o);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/30 font-semibold cursor-pointer flex items-center gap-1"
                          title="Permanently Delete Order"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Order</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setAdminTrackingOrder(null)}
                          className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                        >
                          Close
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const o = adminTrackingOrder;
                            setAdminTrackingOrder(null);
                            handleOpenDispatchModal(o);
                          }}
                          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold cursor-pointer flex items-center gap-1.5 shadow-md"
                        >
                          <Send className="w-4 h-4" />
                          <span>Dispatch Credentials</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* MODAL 4: CANCEL ORDER CONFIRMATION MODAL */}
              {orderToCancel && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
                  <div className="fixed inset-0" onClick={() => setOrderToCancel(null)} />
                  <div className="relative w-full max-w-md rounded-3xl bg-[#090d16] border border-amber-500/50 p-6 shadow-2xl z-10 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                          <XCircle className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-white font-display">Cancel Customer Order</h3>
                          <p className="text-xs text-amber-400 font-mono">{orderToCancel.orderId}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setOrderToCancel(null)}
                        className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-300 space-y-1">
                      <p className="font-semibold text-amber-200">
                        Mark order as CANCELLED across all devices?
                      </p>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        The order status will be updated to Cancelled. The customer will see the cancellation on their live Order Tracker.
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                      <div className="text-slate-400 flex justify-between">
                        <span>Customer:</span>
                        <span className="text-white font-medium">{orderToCancel.customerEmail}</span>
                      </div>
                      <div className="text-slate-400 flex justify-between">
                        <span>Total:</span>
                        <span className="text-emerald-400 font-bold font-mono">${orderToCancel.totalUSD.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 text-xs pt-2">
                      <button
                        type="button"
                        onClick={() => setOrderToCancel(null)}
                        className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                      >
                        Go Back
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmCancel}
                        className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold cursor-pointer shadow-md flex items-center gap-1.5"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Confirm Cancellation</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* MODAL 5: DELETE ORDER PERMANENT CONFIRMATION MODAL */}
              {orderToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
                  <div className="fixed inset-0" onClick={() => setOrderToDelete(null)} />
                  <div className="relative w-full max-w-md rounded-3xl bg-[#090d16] border border-rose-500/50 p-6 shadow-2xl z-10 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                          <Trash2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-white font-display">Delete Order Permanently</h3>
                          <p className="text-xs text-rose-400 font-mono">{orderToDelete.orderId}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setOrderToDelete(null)}
                        className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/30 text-xs text-rose-300 space-y-2">
                      <p className="font-semibold text-rose-200">
                        Are you sure you want to permanently delete this order?
                      </p>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        This will permanently purge order <strong className="text-white font-mono">{orderToDelete.orderId}</strong> for customer <strong className="text-white">{orderToDelete.customerEmail}</strong> from Cloud Firestore and the server database. This action cannot be undone.
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                      <div className="text-slate-400 flex justify-between">
                        <span>Items:</span>
                        <span className="text-white font-medium">{orderToDelete.items.map((i) => i.product.name).join(', ')}</span>
                      </div>
                      <div className="text-slate-400 flex justify-between">
                        <span>Total:</span>
                        <span className="text-emerald-400 font-bold font-mono">${orderToDelete.totalUSD.toFixed(2)}</span>
                      </div>
                      <div className="text-slate-400 flex justify-between">
                        <span>Status:</span>
                        <span className="font-bold uppercase text-slate-300">{orderToDelete.status}</span>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 text-xs pt-2">
                      <button
                        type="button"
                        onClick={() => setOrderToDelete(null)}
                        className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                      >
                        Keep Order
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmDelete}
                        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer shadow-md flex items-center gap-1.5"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Permanently Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: COUPONS & DISCOUNTS */}
          {activeTab === 'coupons' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-black text-white font-display">Coupons & Promo Codes</h2>
                <p className="text-xs text-slate-400 mt-0.5">Create checkout discount codes for USA creators and seasonal sales.</p>
              </div>

              {/* Add Coupon Form */}
              <form onSubmit={handleAddCoupon} className="p-5 rounded-2xl bg-[#090d16] border border-slate-800 flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Coupon Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. USA15"
                    value={newCouponCode}
                    onChange={(e) => setNewCouponCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white uppercase font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="w-28">
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Discount %</label>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    required
                    value={newCouponDiscount}
                    onChange={(e) => setNewCouponDiscount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="flex-1">
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Description / Campaign</label>
                  <input
                    type="text"
                    placeholder="e.g. Summer Creator Discount"
                    value={newCouponDesc}
                    onChange={(e) => setNewCouponDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer shrink-0"
                >
                  Create Coupon
                </button>
              </form>

              {/* Coupons List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {coupons.map((c) => (
                  <div
                    key={c.code}
                    className={`p-5 rounded-2xl border flex flex-col justify-between ${
                      c.active
                        ? 'bg-[#090d16] border-slate-800'
                        : 'bg-slate-950/40 border-slate-900 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-sm font-extrabold text-cyan-400 tracking-wider">
                          {c.code}
                        </span>
                        <span className="text-xs font-black text-emerald-400 tabular-nums">
                          {c.discountPercent}% OFF
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{c.description}</p>
                    </div>

                    <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between mt-4">
                      <button
                        onClick={() => handleToggleCoupon(c.code)}
                        className={`text-[11px] font-bold cursor-pointer ${
                          c.active ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                      >
                        {c.active ? '● Active' : '○ Disabled'}
                      </button>

                      <button
                        onClick={() => handleDeleteCoupon(c.code)}
                        className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                        title="Delete Coupon"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: PROOFS & ACTIVATIONS */}
          {activeTab === 'proofs' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-black text-white font-display">Customer Proofs & Real-Time Feed</h2>
                <p className="text-xs text-slate-400 mt-0.5">Control live order activations and manage customer reviews shown on the storefront.</p>
              </div>

              {/* Add Activation Proof Form */}
              <form onSubmit={handleAddActivation} className="p-5 rounded-2xl bg-[#090d16] border border-slate-800 space-y-3">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-display">
                  Publish New Live Activation Proof to Stream
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Product Name</label>
                    <input
                      type="text"
                      required
                      value={newActProduct}
                      onChange={(e) => setNewActProduct(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Customer Masked Email</label>
                    <input
                      type="text"
                      required
                      value={newActEmail}
                      onChange={(e) => setNewActEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">City, State</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={newActCity}
                        onChange={(e) => setNewActCity(e.target.value)}
                        placeholder="City"
                        className="w-2/3 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                      />
                      <input
                        type="text"
                        value={newActState}
                        onChange={(e) => setNewActState(e.target.value)}
                        placeholder="State"
                        className="w-1/3 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Plan Duration</label>
                    <input
                      type="text"
                      value={newActDuration}
                      onChange={(e) => setNewActDuration(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                >
                  Add to Live Stream
                </button>
              </form>

              {/* Current Stream Preview */}
              <div className="rounded-2xl bg-[#090d16] border border-slate-800 p-4 space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Active Live Stream Feed ({activations.length} Events)
                </span>
                {activations.map((a) => (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                    <div>
                      <span className="font-bold text-white">{a.productName}</span>
                      <span className="text-slate-400 ml-2">({a.planDuration})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-cyan-400">{a.customerMasked}</span>
                      <span className="text-slate-400">{a.city}, {a.state}</span>
                      <button
                        onClick={() => onUpdateActivations(activations.filter((x) => x.id !== a.id))}
                        className="text-slate-600 hover:text-rose-400 cursor-pointer"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: STORE CONFIGURATION */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-black text-white font-display">Store Configuration & Announcements</h2>
                <p className="text-xs text-slate-400 mt-0.5">Customize global storefront messaging, alerts, and backup data.</p>
              </div>

              <div className="p-6 rounded-3xl bg-[#090d16] border border-slate-800 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-white uppercase tracking-wider">
                      Top Announcement Bar Ticker Text
                    </label>
                    <button
                      type="button"
                      onClick={async () => {
                        onUpdateAnnouncement(announcementText);
                        try {
                          await apiUpdateAnnouncement(announcementText);
                          alert('Announcement banner saved to database successfully!');
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                      className="px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-[11px] font-bold cursor-pointer"
                    >
                      Save to Database
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={announcementText}
                    onChange={(e) => onUpdateAnnouncement(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Updates live immediately in the top banner across the website.
                  </span>
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white">Default Store Currency</h4>
                    <p className="text-[11px] text-slate-400">Target audience configured for United States (USD $)</p>
                  </div>
                  <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono text-xs font-bold">
                    USD ($)
                  </span>
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white">Reset Storefront to Factory Defaults</h4>
                    <p className="text-[11px] text-slate-400">Restores all original 32 products and prices.</p>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm('Reset store to default products and prices?')) {
                        localStorage.clear();
                        window.location.reload();
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Reset All Data
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>

      </div>

    </div>
  );
};

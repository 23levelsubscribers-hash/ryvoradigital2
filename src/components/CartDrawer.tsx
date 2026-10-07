import React, { useState, useRef, useEffect } from 'react';
import { X, Trash2, ShoppingBag, ShieldCheck, Zap, ArrowRight, Tag, CreditCard, Check, Upload, Image as ImageIcon, Copy, AlertCircle, Loader2 } from 'lucide-react';
import { CartItem, CurrencyCode, CustomerOrder } from '../types';
import { formatPrice } from '../utils/currency';
import { apiCreateOrder, apiUploadProof } from '../utils/api';
import { firestoreCreateOrder } from '../lib/firebase';

function compressImage(file: File, maxWidth = 900, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  currency: CurrencyCode;
  onUpdateQuantity: (index: number, newQty: number) => void;
  onRemoveItem: (index: number) => void;
  onClearCart: () => void;
  onOrderCompleted: (order: CustomerOrder) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  currency,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onOrderCompleted,
}) => {
  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscountPercent, setAppliedDiscountPercent] = useState(0);
  const [couponMessage, setCouponMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<'bank' | 'crypto'>('bank');
  const [transactionId, setTransactionId] = useState('');
  const [paymentProof, setPaymentProof] = useState<string | null>(null);
  const [paymentProofName, setPaymentProofName] = useState<string>('');
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [copiedInfo, setCopiedInfo] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to completely clear and reset the checkout form for subsequent orders
  const resetCheckoutForm = () => {
    setCustomerEmail('');
    setCustomerPhone('');
    setTransactionId('');
    setPaymentProof(null);
    setPaymentProofName('');
    setIsUploadingProof(false);
    setSelectedPayment('bank');
    setCouponCode('');
    setAppliedDiscountPercent(0);
    setCouponMessage(null);
    setFormError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Reset proof and transaction details whenever cart items are emptied
  useEffect(() => {
    if (items.length === 0) {
      setPaymentProof(null);
      setPaymentProofName('');
      setTransactionId('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [items.length]);

  // Calculate totals
  const subtotalUSD = items.reduce((sum, item) => sum + (item.priceUSD || 0) * (item.quantity || 1), 0);
  const discountUSD = Number(((subtotalUSD * appliedDiscountPercent) / 100).toFixed(2));
  const totalUSD = Math.max(0, Number((subtotalUSD - discountUSD).toFixed(2)));

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponCode.trim().toUpperCase();
    if (code === 'USA10' || code === 'RYVORA10') {
      setAppliedDiscountPercent(10);
      setCouponMessage({ text: '10% USA Community Discount applied!' });
    } else if (code === 'SAVE20' || code === 'VIP20') {
      setAppliedDiscountPercent(20);
      setCouponMessage({ text: '20% VIP Creator Discount applied!' });
    } else if (code === 'CREATOR15') {
      setAppliedDiscountPercent(15);
      setCouponMessage({ text: '15% Creator Discount applied!' });
    } else {
      setCouponMessage({ text: 'Invalid coupon code. Try "USA10"', error: true });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFormError('Please upload an image file (PNG, JPG, or WEBP) for the payment screenshot.');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setFormError('Image size exceeds 20MB limit. Please choose a smaller image.');
      return;
    }

    setFormError('');
    setPaymentProofName(file.name);
    setIsUploadingProof(true);

    try {
      const compressedData = await compressImage(file, 900, 0.72);
      setPaymentProof(compressedData);
    } catch (err: any) {
      console.warn('Compression error, attempting direct file read:', err);
      const reader = new FileReader();
      reader.onload = () => {
        setPaymentProof(reader.result as string);
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploadingProof(false);
    }
  };

  const handleCopyPaymentInfo = (text: string, keyName: string = 'main') => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setCopiedInfo(true);
    setTimeout(() => {
      setCopiedKey(null);
      setCopiedInfo(false);
    }, 2000);
  };

  const paymentDetailsMap: Record<
    'bank' | 'crypto',
    {
      name: string;
      address: string;
      shortCopy: string;
      instructions: string;
      isBank?: boolean;
      bankName?: string;
      accountTitle?: string;
      accountNumber?: string;
      routingNumber?: string;
      accountType?: string;
      swiftCode?: string;
      transferType?: string;
      bankAddress?: string;
      cryptoNetwork?: string;
    }
  > = {
    bank: {
      name: 'Citibank Local Transfer (USA)',
      address: 'Bank: Citibank | Beneficiary: Usman Ghani | Routing: 031100209 | Acc #: 70587190002673170',
      shortCopy: '70587190002673170',
      instructions: 'Transfer the order amount to our Citibank account via ACH or wire. Enter reference or attach screenshot.',
      isBank: true,
      bankName: 'Citibank',
      accountTitle: 'Usman Ghani',
      accountNumber: '70587190002673170',
      routingNumber: '031100209',
      accountType: 'CHECKING',
      swiftCode: 'CITIUS33',
      transferType: 'Local transfer',
      bankAddress: '111 Wall Street New York, NY 10043 USA',
    },
    crypto: {
      name: 'USDT (TRC20 Network)',
      address: 'TDL5DcGTb99Aer5T3xvNgBxThj9RJqhwz7',
      shortCopy: 'TDL5DcGTb99Aer5T3xvNgBxThj9RJqhwz7',
      instructions: 'Send USDT via TRC20 (Tron) network only. Enter your Transaction Hash (TxID) or upload screenshot below.',
      cryptoNetwork: 'TRC20 (Tron Network)',
    },
  };

  const currentPayInfo = paymentDetailsMap[selectedPayment] || paymentDetailsMap.bank;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerEmail.trim() || !customerEmail.includes('@')) {
      setFormError('Please enter a valid email address to receive account credentials.');
      return;
    }

    setFormError('');
    setIsSubmitting(true);

    const finalProof = paymentProof && typeof paymentProof === 'string' && paymentProof.trim()
      ? paymentProof.trim()
      : undefined;

    try {
      const newOrder = await apiCreateOrder({
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone.trim() || undefined,
        items: [...items],
        couponCode: couponCode.trim() || undefined,
        paymentMethod: currentPayInfo.name,
        paymentProof: finalProof,
        transactionId: transactionId.trim() || undefined,
      });

      // Sync to cloud Firestore for instant multi-device live sync
      firestoreCreateOrder(newOrder).catch((e) => console.warn('Firestore sync notice:', e));

      setIsSubmitting(false);
      resetCheckoutForm();
      onClearCart();
      onClose();
      onOrderCompleted(newOrder);
    } catch (err: any) {
      console.warn('Server order error, using resilient local backup order:', err);
      // Fallback resilient order creation so customer is NEVER stuck
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
      const fallbackOrderId = `RYV-${Math.floor(10000 + Math.random() * 90000)}-US`;

      const fallbackOrder: CustomerOrder = {
        orderId: fallbackOrderId,
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone.trim() || undefined,
        items: [...items],
        subtotalUSD,
        discountUSD,
        totalUSD,
        coupon: couponCode.trim() ? couponCode.trim().toUpperCase() : undefined,
        paymentMethod: currentPayInfo.name,
        paymentProof: finalProof || undefined,
        transactionId: transactionId.trim() || undefined,
        status: 'processing',
        createdAt: `Today, ${timeStr} (${dateStr})`,
        isNew: true,
      };

      // Sync to cloud Firestore for instant multi-device live sync
      firestoreCreateOrder(fallbackOrder).catch((e) => console.warn('Firestore fallback sync notice:', e));

      setIsSubmitting(false);
      resetCheckoutForm();
      onClearCart();
      onClose();
      onOrderCompleted(fallbackOrder);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="absolute inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
        <div className="w-screen max-w-md bg-[#090d16] border-l border-slate-800 text-slate-100 flex flex-col shadow-2xl relative z-10">
          
          {/* Header */}
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-bold text-white font-display">Shopping Bag</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold">
                {items.reduce((s, i) => s + i.quantity, 0)} items
              </span>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cart Contents */}
          {items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-4">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">Your bag is empty</h3>
              <p className="text-xs text-slate-400 max-w-xs mb-6">
                Explore our catalog of genuine AI tools, designer suites, and developer licenses.
              </p>
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
              >
                Browse Store Catalog
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              
              {/* Items List */}
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div
                    key={`${item.product?.id || 'item'}-${item.duration || 'plan'}-${idx}`}
                    className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex gap-3 relative group"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0"
                      style={{
                        backgroundColor: `${item.product?.brandColor || '#06b6d4'}20`,
                        color: item.product?.brandColor || '#06b6d4',
                        border: `1px solid ${item.product?.brandColor || '#06b6d4'}40`,
                      }}
                    >
                      {(item.product?.name || 'P').charAt(0)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-white truncate text-xs">
                          {item.product?.name || 'Subscription License'}
                        </h4>
                        <button
                          onClick={() => onRemoveItem(idx)}
                          className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1.5 my-1 text-[10px]">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-medium capitalize">
                          {(item.duration || '1_month').replace(/_/g, ' ')}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 capitalize">
                          {(item.accountType || 'private_account').replace(/_/g, ' ')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1 mt-1 border-t border-slate-800/60">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onUpdateQuantity(idx, item.quantity - 1)}
                            className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 cursor-pointer"
                          >
                            -
                          </button>
                          <span className="font-semibold text-white px-1">{item.quantity}</span>
                          <button
                            onClick={() => onUpdateQuantity(idx, item.quantity + 1)}
                            className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 cursor-pointer"
                          >
                            +
                          </button>
                        </div>

                        <span className="font-bold text-emerald-400 text-xs font-mono">
                          {formatPrice((item.priceUSD || 0) * (item.quantity || 1), currency)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Promo Code Form */}
              <form onSubmit={handleApplyCoupon} className="pt-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Promo Coupon (e.g. USA10)"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 uppercase font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
                {couponMessage && (
                  <p
                    className={`text-[11px] mt-1.5 ${
                      couponMessage.error ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {couponMessage.text}
                  </p>
                )}
              </form>

              {/* Delivery Contact Information */}
              <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Contact for Account Delivery:</span>
                  {(customerEmail || customerPhone || paymentProof || transactionId) ? (
                    <button
                      type="button"
                      onClick={resetCheckoutForm}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer underline transition-colors"
                    >
                      Clear / Reset Form
                    </button>
                  ) : (
                    <span className="text-[10px] text-amber-400 font-normal">Delivered after verification</span>
                  )}
                </label>
                
                <div>
                  <input
                    type="email"
                    required
                    placeholder="Your Email Address (Account will be sent here) *"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Account credentials and login details will be delivered to this email after verifying payment.
                  </span>
                </div>

                <div>
                  <input
                    type="text"
                    placeholder="WhatsApp Number or Telegram / Discord (Optional)"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Payment Methods Selection */}
              <div className="pt-3 border-t border-slate-800/80">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Select Payment Method:
                </label>
                
                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <button
                    type="button"
                    onClick={() => setSelectedPayment('bank')}
                    className={`p-3 rounded-xl border text-left flex items-center gap-2.5 cursor-pointer transition-all ${
                      selectedPayment === 'bank'
                        ? 'border-cyan-400 bg-cyan-950/50 text-white shadow-[0_0_12px_rgba(6,182,212,0.25)] ring-1 ring-cyan-500/50'
                        : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs shrink-0">
                      🏦
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-xs block text-white">Bank Transfer</span>
                      <span className="text-[10px] text-cyan-400 font-medium block truncate">Citibank (USA)</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedPayment('crypto')}
                    className={`p-3 rounded-xl border text-left flex items-center gap-2.5 cursor-pointer transition-all ${
                      selectedPayment === 'crypto'
                        ? 'border-emerald-400 bg-emerald-950/50 text-white shadow-[0_0_12px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500/50'
                        : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                      ₮
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-xs block text-white">USDT (Crypto)</span>
                      <span className="text-[10px] text-emerald-400 font-medium block truncate">TRC20 Network</span>
                    </div>
                  </button>
                </div>

                {/* Selected Payment Instructions Card */}
                {selectedPayment === 'bank' ? (
                  <div className="p-3.5 rounded-2xl bg-gradient-to-b from-[#0a101d] to-[#080c16] border border-cyan-500/40 text-xs space-y-2.5 shadow-lg">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-md bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs">
                          🏦
                        </div>
                        <span className="font-extrabold text-white text-xs">
                          Citibank Local Transfer (USA)
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full">
                        Local Transfer (ACH / Wire)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {/* Beneficiary Name */}
                      <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
                          Beneficiary Name
                        </span>
                        <span className="font-bold text-white text-xs block mt-0.5">
                          {currentPayInfo.accountTitle}
                        </span>
                      </div>

                      {/* Bank Name */}
                      <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
                          Bank Name
                        </span>
                        <span className="font-bold text-white text-xs block mt-0.5">
                          {currentPayInfo.bankName}
                        </span>
                      </div>

                      {/* Account Number - Compulsory */}
                      <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/50 sm:col-span-2 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-cyan-300 uppercase tracking-wider block font-bold">
                            Account Number (Compulsory)
                          </span>
                          <span className="font-mono font-extrabold text-cyan-200 text-sm tracking-wider block mt-0.5 select-all">
                            {currentPayInfo.accountNumber}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyPaymentInfo(currentPayInfo.accountNumber || '', 'acc')}
                          className="px-2.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                        >
                          {copiedKey === 'acc' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedKey === 'acc' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>

                      {/* Routing Number (ABA) */}
                      <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
                            Routing (ABA)
                          </span>
                          <span className="font-mono font-bold text-white text-xs block mt-0.5 select-all">
                            {currentPayInfo.routingNumber}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyPaymentInfo(currentPayInfo.routingNumber || '', 'routing')}
                          className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          {copiedKey === 'routing' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedKey === 'routing' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>

                      {/* Account Type */}
                      <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
                          Account Type
                        </span>
                        <span className="font-bold text-white text-xs block mt-0.5">
                          {currentPayInfo.accountType}
                        </span>
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-400">
                      {currentPayInfo.instructions}
                    </p>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-gradient-to-b from-[#0a1813] to-[#08110e] border border-emerald-500/40 text-xs space-y-2.5 shadow-lg">
                    <div className="flex items-center justify-between pb-2 border-b border-emerald-900/40">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                          ₮
                        </div>
                        <span className="font-extrabold text-white text-xs">
                          USDT (Tether USD)
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                        TRC20 Network
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/90 border border-emerald-500/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                          TRC20 Deposit Address:
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyPaymentInfo(currentPayInfo.address, 'crypto_addr')}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                        >
                          {copiedKey === 'crypto_addr' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedKey === 'crypto_addr' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>

                      <div className="font-mono text-xs text-white bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 select-all break-all tracking-wide font-semibold text-center sm:text-left">
                        {currentPayInfo.address}
                      </div>
                    </div>

                    <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300/90 flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400 mt-0.5" />
                      <span>
                        <strong>Important:</strong> Please ensure you send USDT strictly on the <strong>TRC20 (Tron)</strong> network. Sending via ERC20, BEP20, or other networks may result in lost funds.
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-400">
                      {currentPayInfo.instructions}
                    </p>
                  </div>
                )}
              </div>

              {/* PAYMENT SCREENSHOT PROOF UPLOAD (Optional) */}
              <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1 text-cyan-400">
                    <ImageIcon className="w-3.5 h-3.5" />
                    Payment Screenshot (Optional)
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                </label>

                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {/* Upload Trigger / Preview Box */}
                {!paymentProof ? (
                  <button
                    type="button"
                    disabled={isUploadingProof}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full p-3.5 rounded-xl border border-dashed border-slate-700 hover:border-cyan-500/60 bg-slate-950/60 hover:bg-slate-900/40 text-center transition-all cursor-pointer group flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-900 group-hover:bg-cyan-950/40 border border-slate-800 group-hover:border-cyan-500/40 flex items-center justify-center text-slate-400 group-hover:text-cyan-400 transition-colors shrink-0">
                      {isUploadingProof ? (
                        <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                    </div>
                    <div className="text-left min-w-0">
                      <span className="text-xs font-semibold text-white block">
                        {isUploadingProof ? 'Attaching screenshot...' : 'Upload receipt screenshot (Optional)'}
                      </span>
                      <span className="text-[10px] text-slate-400 block truncate">
                        PNG, JPG, or screenshot (or skip and provide Ref below)
                      </span>
                    </div>
                  </button>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/40 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={paymentProof}
                        alt="Payment Proof Screenshot"
                        className="w-12 h-12 object-cover rounded-lg border border-slate-800 shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-white flex items-center gap-1 truncate">
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate">{paymentProofName || 'Payment_Proof.png'}</span>
                        </span>
                        <span className="text-[10px] text-emerald-400 block">Screenshot attached successfully</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setPaymentProof(null);
                        setPaymentProofName('');
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-[11px] text-slate-400 hover:text-rose-400 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                )}

                {/* Optional Transaction ID / Sender Note */}
                <div>
                  <input
                    type="text"
                    placeholder="Transaction ID / Sender Name / Reference Note (Optional)"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>

                {formError && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}
              </div>

              {/* Price Breakdown */}
              <div className="pt-3 border-t border-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal</span>
                  <span className="text-slate-200 tabular-nums">{formatPrice(subtotalUSD, currency)}</span>
                </div>

                {appliedDiscountPercent > 0 && (
                  <div className="flex justify-between text-emerald-400 font-medium">
                    <span>Discount ({appliedDiscountPercent}%)</span>
                    <span className="tabular-nums">-{formatPrice(discountUSD, currency)}</span>
                  </div>
                )}

                <div className="flex justify-between text-slate-400">
                  <span>Delivery Fee</span>
                  <span className="text-emerald-400 font-semibold">FREE ($0.00)</span>
                </div>

                <div className="flex justify-between text-base font-extrabold text-white pt-2 border-t border-slate-800/80">
                  <span>Total Due</span>
                  <span className="text-emerald-400 font-display tabular-nums">
                    {formatPrice(totalUSD, currency)}
                  </span>
                </div>
              </div>

            </div>
          )}

          {/* Sticky Checkout Button Footer */}
          {items.length > 0 && (
            <div className="p-5 border-t border-slate-800 bg-[#070a12] space-y-3">
              <button
                disabled={isSubmitting}
                onClick={handleCheckout}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 text-slate-950 hover:brightness-110 shadow-[0_0_20px_rgba(52,211,153,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Placing Your Order...</span>
                  </>
                ) : (
                  <>
                    <span>Place Order Now</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-3 text-[10px] text-slate-500">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Instant Order Confirmation
                </span>
                <span>·</span>
                <span>Email & WhatsApp Delivery</span>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

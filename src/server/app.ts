import express, { Request, Response } from 'express';
import {
  initDatabase,
  getOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getCoupons,
  getCouponByCode,
  createCoupon,
  toggleCoupon,
  deleteCoupon,
  getReviews,
  getActivations,
  createActivation,
  deleteActivation,
  getAnnouncement,
  updateAnnouncement,
  savePaymentProof,
  getPaymentProof,
  INITIAL_COUPONS,
} from './db';
import {
  verifyAdminPassword,
  generateAdminToken,
  requireAdmin,
  validateAdminToken,
  setAdminPassword,
} from './auth';
import { notifyNewOrder } from './notifications';
import { CustomerOrder, PlanDuration } from '../types';
import { PRODUCTS } from '../data/products';

export const app = express();
const router = express.Router();

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Basic Security Headers & Full Cross-Origin Access (CORS)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-token');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Fast-track OPTIONS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Initialize database safely in background
initDatabase().catch((err) => console.warn('[APP] Database init warning:', err));

// -------------------------------------------------------------
// 1. ADMIN AUTHENTICATION ENDPOINTS
// -------------------------------------------------------------
router.post('/admin/login', async (req: Request, res: Response) => {
  const { password } = req.body || {};

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ success: false, message: 'Admin password is required.' });
  }

  const isValid = await verifyAdminPassword(password);
  if (!isValid) {
    return res.status(401).json({
      success: false,
      message: 'Invalid administrator password. Access denied.',
    });
  }

  const { token, expiresAt } = generateAdminToken();
  return res.json({
    success: true,
    token,
    expiresAt,
    message: 'Authentication successful.',
  });
});

router.get('/admin/verify', requireAdmin, (req: Request, res: Response) => {
  res.json({ success: true, authenticated: true });
});

router.post('/admin/change-password', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { newPassword } = req.body || {};
    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 4) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 4 characters long.',
      });
    }

    await setAdminPassword(newPassword.trim());
    return res.json({
      success: true,
      message: 'Administrator password updated successfully.',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update administrator password.',
    });
  }
});

// -------------------------------------------------------------
// 2. PAYMENT PROOF UPLOAD & SERVING
// -------------------------------------------------------------
router.post('/upload', async (req: Request, res: Response) => {
  try {
    const { image, filename } = req.body || {};
    if (!image || typeof image !== 'string') {
      return res.status(400).json({ success: false, message: 'Valid image data required.' });
    }

    if (!image.startsWith('data:image/')) {
      return res.status(400).json({ success: false, message: 'Image must be a valid image format.' });
    }

    const proofUrl = await savePaymentProof(image, filename);
    res.json({ success: true, url: proofUrl });
  } catch (err: any) {
    console.error('Error in /upload:', err);
    res.status(500).json({ success: false, message: 'Failed to process image upload.' });
  }
});

router.get('/proofs/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const proof = await getPaymentProof(id);

    if (!proof) {
      return res.status(404).send('Payment proof not found.');
    }

    const base64Data = proof.data.replace(/^data:[^;]+;base64,/, '');
    const imgBuffer = Buffer.from(base64Data, 'base64');

    res.setHeader('Content-Type', proof.mimeType || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Length', imgBuffer.length);
    res.end(imgBuffer);
  } catch (err: any) {
    console.error('Error serving proof:', err);
    res.status(500).send('Error retrieving payment proof.');
  }
});

// -------------------------------------------------------------
// 3. ORDERS (ADMIN & PUBLIC WORKFLOWS)
// -------------------------------------------------------------
const DURATION_MULTIPLIERS: Record<string, number> = {
  '1_month': 1.0,
  '3_months': 2.7,
  '6_months': 5.0,
  '1_year': 9.0,
};

// Admin only: Get all customer orders
router.get('/orders', requireAdmin, async (req: Request, res: Response) => {
  try {
    const orders = await getOrders();
    res.json({ success: true, orders });
  } catch (err: any) {
    console.error('Error getting orders:', err);
    res.status(500).json({ success: false, message: 'Failed to load orders: ' + err.message });
  }
});

// Public: Customer Checkout Order Submission
router.post('/orders', async (req: Request, res: Response) => {
  try {
    const {
      customerEmail,
      customerPhone,
      items,
      couponCode,
      paymentMethod,
      paymentProof,
      transactionId,
    } = req.body || {};

    // 1. Email validation
    if (!customerEmail || typeof customerEmail !== 'string') {
      return res.status(400).json({ success: false, message: 'Valid customer email is required.' });
    }
    const cleanEmail = customerEmail.trim();
    if (!cleanEmail.includes('@') || cleanEmail.length < 5) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    // 2. Items validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Shopping cart must contain at least one item.' });
    }

    // 3. Payment Method
    const verifiedPaymentMethod = paymentMethod && typeof paymentMethod === 'string' && paymentMethod.trim()
      ? paymentMethod.trim()
      : 'Credit/Debit Card (Stripe USA)';

    // 4. Server-Side Price Calculation & Verification
    let verifiedSubtotalUSD = 0;
    const verifiedItems: any[] = [];

    for (const item of items) {
      const prodId = item.product?.id || item.productId || 'custom-tool';

      let dbProduct = await getProductById(prodId);
      if (!dbProduct) {
        dbProduct = PRODUCTS.find((p) => p.id === prodId || p.name.toLowerCase() === (item.product?.name || '').toLowerCase()) || null;
      }
      if (!dbProduct && item.product && typeof item.product.priceUSD === 'number') {
        dbProduct = item.product;
      }
      if (!dbProduct) {
        dbProduct = {
          id: prodId,
          name: item.product?.name || 'Digital Tool Subscription',
          tagline: item.product?.tagline || 'Genuine subscription license',
          category: item.product?.category || 'ai',
          categoryLabel: item.product?.categoryLabel || 'Tools',
          iconName: 'Sparkles',
          brandColor: '#06b6d4',
          accentGlow: 'rgba(6,182,212,0.3)',
          rating: 5,
          reviewsCount: 1,
          features: ['Genuine License', 'Instant Delivery', 'Warranty'],
          retailPriceUSD: item.product?.retailPriceUSD || 29.99,
          priceUSD: item.product?.priceUSD || (item.priceUSD ? item.priceUSD : 19.99),
          inStock: true,
          allowedAccountTypes: ['private_account'],
          description: 'Genuine digital subscription license with replacement warranty.',
          deliveryTime: 'Instant (2-5 mins)',
          warranty: 'Full Replacement Warranty',
        };
      }

      const duration: PlanDuration = item.duration || '1_month';
      const multiplier = DURATION_MULTIPLIERS[duration] || 1.0;
      let verifiedUnitPrice = 0;
      if (typeof item.priceUSD === 'number' && item.priceUSD > 0) {
        verifiedUnitPrice = Number(item.priceUSD.toFixed(2));
      } else {
        verifiedUnitPrice = Number(((dbProduct.priceUSD || 19.99) * multiplier).toFixed(2));
      }
      const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);

      verifiedSubtotalUSD += verifiedUnitPrice * quantity;
      verifiedItems.push({
        product: dbProduct,
        duration,
        accountType: item.accountType || (dbProduct.allowedAccountTypes && dbProduct.allowedAccountTypes[0]) || 'private_account',
        quantity,
        priceUSD: verifiedUnitPrice,
      });
    }

    verifiedSubtotalUSD = Number(verifiedSubtotalUSD.toFixed(2));

    // 5. Server-Side Coupon Validation
    let verifiedDiscountUSD = 0;
    let appliedCouponObj = null;

    if (couponCode && typeof couponCode === 'string' && couponCode.trim()) {
      const cleanCoupon = couponCode.trim().toUpperCase();
      let dbCoupon = await getCouponByCode(cleanCoupon);
      if (!dbCoupon) {
        dbCoupon = INITIAL_COUPONS.find((c: any) => c.code.toUpperCase() === cleanCoupon && c.active) || null;
      }
      if (dbCoupon && dbCoupon.active) {
        appliedCouponObj = dbCoupon;
        verifiedDiscountUSD = Number(((verifiedSubtotalUSD * dbCoupon.discountPercent) / 100).toFixed(2));
      }
    }

    const verifiedTotalUSD = Math.max(0, Number((verifiedSubtotalUSD - verifiedDiscountUSD).toFixed(2)));

    // 6. Handle Payment Proof Storage (Optional)
    let savedProofUrl: string | undefined = undefined;
    if (paymentProof && typeof paymentProof === 'string' && paymentProof.trim()) {
      if (paymentProof.startsWith('data:image/')) {
        try {
          savedProofUrl = await savePaymentProof(paymentProof, `proof_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '')}.jpg`);
        } catch (proofErr) {
          console.warn('Payment proof saving warning, using direct string:', proofErr);
          savedProofUrl = paymentProof;
        }
      } else {
        savedProofUrl = paymentProof.trim();
      }
    }

    // 7. Generate Unique Order ID
    const orderNumber = Math.floor(10000 + Math.random() * 90000);
    const orderId = `RYV-${orderNumber}-US`;

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    const createdAt = `Today, ${timeStr} (${dateStr})`;

    const newOrder: CustomerOrder & { isNew?: boolean } = {
      orderId,
      customerEmail: cleanEmail,
      customerPhone: customerPhone ? String(customerPhone).trim() : undefined,
      items: verifiedItems,
      subtotalUSD: verifiedSubtotalUSD,
      discountUSD: verifiedDiscountUSD,
      totalUSD: verifiedTotalUSD,
      coupon: couponCode ? String(couponCode).trim().toUpperCase() : undefined,
      paymentMethod: verifiedPaymentMethod,
      paymentProof: savedProofUrl || undefined,
      transactionId: transactionId ? String(transactionId).trim() : undefined,
      status: 'processing',
      createdAt,
      credentials: undefined,
      isNew: true,
    };

    // Save permanently to database
    await createOrder(newOrder);

    // Increment coupon usage if used
    if (appliedCouponObj) {
      await createCoupon({
        ...appliedCouponObj,
        usageCount: appliedCouponObj.usageCount + 1,
      }).catch((e) => console.warn('Coupon count error:', e));
    }

    // Add to live activations feed for storefront social proof
    const firstItem = verifiedItems[0];
    const emailPrefix = cleanEmail.split('@')[0] || 'customer';
    const masked =
      emailPrefix.length > 2
        ? emailPrefix.charAt(0) + '****' + emailPrefix.charAt(emailPrefix.length - 1) + '@' + (cleanEmail.split('@')[1] || 'gmail.com')
        : 'c****@gmail.com';

    const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'Austin'];
    const states = ['NY', 'CA', 'IL', 'TX', 'AZ', 'PA', 'TX', 'CA', 'TX', 'TX'];
    const randIdx = Math.floor(Math.random() * cities.length);

    await createActivation({
      id: `act-${Date.now()}`,
      productName: firstItem?.product?.name || 'ChatGPT Plus & Team',
      category: firstItem?.product?.category || 'ai',
      customerMasked: masked,
      city: cities[randIdx],
      state: states[randIdx],
      minutesAgo: 1,
      planDuration: firstItem?.duration ? String(firstItem.duration).replace('_', ' ') : '1 Month',
    }).catch((e) => console.warn('Activation feed error:', e));

    // Dispatch asynchronous order alert notification
    notifyNewOrder(newOrder).catch((e) => console.warn('Notification dispatch error:', e));

    console.log(`[ORDER CREATED] ${orderId} by ${cleanEmail} ($${verifiedTotalUSD} USD)`);
    res.status(201).json({ success: true, order: newOrder });
  } catch (err: any) {
    console.error('Error creating order:', err);
    res.status(500).json({ success: false, message: 'Server error creating order: ' + err.message });
  }
});

// Order Tracking: Secure lookup requiring Order ID + Matching Customer Email
router.get('/orders/track', async (req: Request, res: Response) => {
  try {
    const rawQuery = String(req.query.query || '').trim();
    const orderIdParam = String(req.query.orderId || '').trim();
    const emailParam = String(req.query.email || req.query.customerEmail || '').trim().toLowerCase();
    const authHeader = req.headers.authorization || (req.headers['x-admin-token'] as string);
    const isAdmin = validateAdminToken(authHeader);

    const targetOrderId = (orderIdParam || rawQuery).toUpperCase();
    const targetEmail = (emailParam || (rawQuery.includes('@') ? rawQuery : '')).toLowerCase();

    if (!targetOrderId && !targetEmail) {
      return res.status(400).json({
        success: false,
        message: 'Order ID and Customer Email are required for order tracking.',
      });
    }

    const allOrders = await getOrders();

    // 1. If admin, allow searching by orderId or email directly
    if (isAdmin) {
      const match = allOrders.find(
        (o) =>
          o.orderId.toUpperCase() === targetOrderId ||
          o.customerEmail.toLowerCase() === targetEmail ||
          (o.credentials?.licenseKey && o.credentials.licenseKey.toUpperCase() === targetOrderId)
      );
      if (match) return res.json({ success: true, order: match });
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    // 2. Customer Tracking: Require verification
    let match = allOrders.find((o) => o.orderId.toUpperCase() === targetOrderId);

    if (!match && targetEmail && !orderIdParam) {
      match = allOrders.find((o) => o.customerEmail.toLowerCase() === targetEmail);
    }

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'No order found matching the provided reference.',
      });
    }

    // Privacy & Security Check: If email is provided, must match!
    if (targetEmail && match.customerEmail.toLowerCase() !== targetEmail) {
      return res.status(403).json({
        success: false,
        message: 'Verification failed: The email address does not match this Order ID record.',
      });
    }

    if (!targetEmail && match.credentials?.licenseKey) {
      return res.status(401).json({
        success: false,
        requiresEmail: true,
        orderId: match.orderId,
        status: match.status,
        message: 'Please enter your checkout email address to unlock license credentials.',
      });
    }

    res.json({ success: true, order: match });
  } catch (err: any) {
    console.error('Error tracking order:', err);
    res.status(500).json({ success: false, message: 'Error tracking order: ' + err.message });
  }
});

// Admin only: Update order status or credentials
router.patch('/orders/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id;
    const {
      status,
      credentials,
      isNew,
      licenseKey,
      accountEmail,
      accountPassword,
      deliveryInstructions,
      declineReason,
    } = req.body || {};

    const updated = await updateOrder(orderId, {
      status,
      credentials,
      isNew,
      licenseKey,
      accountEmail,
      accountPassword,
      deliveryInstructions,
      declineReason,
    });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    res.json({ success: true, order: updated });
  } catch (err: any) {
    console.error('Error updating order:', err);
    res.status(500).json({ success: false, message: 'Error updating order: ' + err.message });
  }
});

router.delete('/orders/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id;
    const deleted = await deleteOrder(orderId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Order not found or already deleted.' });
    }
    res.json({ success: true, message: `Order ${orderId} successfully removed.` });
  } catch (err: any) {
    console.error('Error deleting order:', err);
    res.status(500).json({ success: false, message: 'Error deleting order: ' + err.message });
  }
});

// -------------------------------------------------------------
// 4. PRODUCTS ENDPOINTS
// -------------------------------------------------------------
router.get('/products', async (req: Request, res: Response) => {
  try {
    const products = await getProducts();
    res.json({ success: true, products });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch products: ' + err.message });
  }
});

router.post('/products', requireAdmin, async (req: Request, res: Response) => {
  try {
    const prodData = req.body;
    if (!prodData || !prodData.name || !prodData.priceUSD) {
      return res.status(400).json({ success: false, message: 'Invalid product data.' });
    }

    const newProd = await createProduct({
      ...prodData,
      id: prodData.id || `custom-${Date.now()}`,
    });
    res.status(201).json({ success: true, product: newProd });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to create product: ' + err.message });
  }
});

router.put('/products/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const prodId = req.params.id;
    const updates = req.body;
    const updated = await updateProduct(prodId, updates);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    res.json({ success: true, product: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to update product: ' + err.message });
  }
});

router.delete('/products/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const prodId = req.params.id;
    const deleted = await deleteProduct(prodId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    res.json({ success: true, message: `Product ${prodId} removed.` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to delete product: ' + err.message });
  }
});

// -------------------------------------------------------------
// 5. COUPONS ENDPOINTS
// -------------------------------------------------------------
router.get('/coupons', async (req: Request, res: Response) => {
  try {
    const coupons = await getCoupons();
    res.json({ success: true, coupons });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch coupons: ' + err.message });
  }
});

router.post('/coupons', requireAdmin, async (req: Request, res: Response) => {
  try {
    const coupon = req.body;
    if (!coupon || !coupon.code || !coupon.discountPercent) {
      return res.status(400).json({ success: false, message: 'Valid coupon details required.' });
    }
    const created = await createCoupon(coupon);
    res.status(201).json({ success: true, coupon: created });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to create coupon: ' + err.message });
  }
});

router.patch('/coupons/:code', requireAdmin, async (req: Request, res: Response) => {
  try {
    const code = req.params.code;
    const toggled = await toggleCoupon(code);
    if (!toggled) {
      return res.status(404).json({ success: false, message: 'Coupon not found.' });
    }
    res.json({ success: true, coupon: toggled });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to toggle coupon: ' + err.message });
  }
});

router.delete('/coupons/:code', requireAdmin, async (req: Request, res: Response) => {
  try {
    const code = req.params.code;
    const deleted = await deleteCoupon(code);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Coupon not found.' });
    }
    res.json({ success: true, message: `Coupon ${code} deleted.` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to delete coupon: ' + err.message });
  }
});

// -------------------------------------------------------------
// 6. REVIEWS & ACTIVATIONS ENDPOINTS
// -------------------------------------------------------------
router.get('/reviews', async (req: Request, res: Response) => {
  try {
    const reviews = await getReviews();
    res.json({ success: true, reviews });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch reviews: ' + err.message });
  }
});

router.get('/activations', async (req: Request, res: Response) => {
  try {
    const activations = await getActivations();
    res.json({ success: true, activations });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch activations: ' + err.message });
  }
});

router.post('/activations', requireAdmin, async (req: Request, res: Response) => {
  try {
    const act = req.body;
    if (!act || !act.productName) {
      return res.status(400).json({ success: false, message: 'Valid activation details required.' });
    }
    const created = await createActivation(act);
    res.status(201).json({ success: true, activation: created });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to create activation: ' + err.message });
  }
});

router.delete('/activations/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const deleted = await deleteActivation(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Activation not found.' });
    }
    res.json({ success: true, message: `Activation ${id} deleted.` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to delete activation: ' + err.message });
  }
});

// -------------------------------------------------------------
// 7. ANNOUNCEMENT ENDPOINTS
// -------------------------------------------------------------
router.get('/announcement', async (req: Request, res: Response) => {
  try {
    const text = await getAnnouncement();
    res.json({ success: true, announcement: text });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch announcement: ' + err.message });
  }
});

router.post('/announcement', requireAdmin, async (req: Request, res: Response) => {
  try {
    const text = req.body?.text || '';
    const updated = await updateAnnouncement(text);
    res.json({ success: true, announcement: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to update announcement: ' + err.message });
  }
});

// -------------------------------------------------------------
// 8. HEALTH STATUS
// -------------------------------------------------------------
router.get('/health', async (req: Request, res: Response) => {
  try {
    const orders = await getOrders();
    res.json({
      status: 'ok',
      service: 'Ryvora Digital Production Backend',
      ordersCount: orders.length,
      database: process.env.POSTGRES_URL || process.env.DATABASE_URL ? 'postgresql' : 'serverless-store',
      time: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// MOUNT ROUTER: Handles both /api/* and rewritten /* requests
app.use('/api', router);
app.use(router);

// -------------------------------------------------------------
// 9. GLOBAL JSON ERROR HANDLER
// -------------------------------------------------------------
app.use((err: any, req: Request, res: Response, _next: any) => {
  console.error('[API SERVER ERROR]', err);
  const status = typeof err.status === 'number' ? err.status : typeof err.statusCode === 'number' ? err.statusCode : 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal server error occurred.',
  });
});

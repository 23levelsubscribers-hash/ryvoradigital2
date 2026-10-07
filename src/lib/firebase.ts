import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { CustomerOrder } from '../types';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// CRITICAL: Initialize Firestore with custom database ID from config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Test connection on boot as recommended by skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firebase] Firestore client offline warning.');
    }
  }
}
testConnection();

const ORDERS_COLLECTION = 'orders';

/**
 * Saves a customer order directly to Cloud Firestore.
 * Automatically broadcasts to all connected devices in real-time.
 */
export async function firestoreCreateOrder(order: CustomerOrder): Promise<void> {
  try {
    const orderDocRef = doc(db, ORDERS_COLLECTION, order.orderId);
    
    // Clean and serialize order payload for Firestore
    const firestoreData: Record<string, any> = {
      orderId: order.orderId,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone || null,
      items: JSON.stringify(order.items),
      subtotalUSD: Number(order.subtotalUSD),
      discountUSD: Number(order.discountUSD || 0),
      totalUSD: Number(order.totalUSD),
      coupon: order.coupon || null,
      paymentMethod: order.paymentMethod,
      paymentProof: order.paymentProof || null,
      transactionId: order.transactionId || null,
      status: order.status || 'processing',
      createdAt: order.createdAt,
      updatedAt: new Date().toISOString(),
      licenseKey: order.licenseKey || order.credentials?.licenseKey || null,
      accountEmail: order.accountEmail || order.credentials?.accountEmail || null,
      deliveryInstructions: order.deliveryInstructions || order.credentials?.instructions || null,
      credentials: order.credentials ? JSON.stringify(order.credentials) : null,
      isNew: true,
    };

    await setDoc(orderDocRef, firestoreData, { merge: true });
    console.log(`[Firestore] Order ${order.orderId} synced to cloud database.`);
  } catch (err) {
    console.warn('[Firestore] Warning saving order to Firestore:', err);
  }
}

/**
 * Subscribes to live orders in real-time across all devices.
 * Used by Admin Dashboard to instantly receive customer orders from any laptop or device.
 */
export function firestoreSubscribeOrders(
  onOrdersUpdated: (orders: CustomerOrder[]) => void
): () => void {
  try {
    const ordersCol = collection(db, ORDERS_COLLECTION);
    const q = query(ordersCol);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const ordersList: CustomerOrder[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          let parsedItems = [];
          try {
            parsedItems = typeof data.items === 'string' ? JSON.parse(data.items) : data.items || [];
          } catch {
            parsedItems = [];
          }

          let creds = undefined;
          if (data.credentials) {
            try {
              creds = typeof data.credentials === 'string' ? JSON.parse(data.credentials) : data.credentials;
            } catch {
              creds = undefined;
            }
          } else if (data.licenseKey || data.accountEmail || data.deliveryInstructions) {
            creds = {
              licenseKey: data.licenseKey || '',
              accountEmail: data.accountEmail || '',
              instructions: data.deliveryInstructions || '',
            };
          }

          ordersList.push({
            orderId: data.orderId || docSnap.id,
            customerEmail: data.customerEmail || '',
            customerPhone: data.customerPhone || undefined,
            items: parsedItems,
            subtotalUSD: Number(data.subtotalUSD || 0),
            discountUSD: Number(data.discountUSD || 0),
            totalUSD: Number(data.totalUSD || 0),
            coupon: data.coupon || undefined,
            paymentMethod: data.paymentMethod || 'Credit/Debit Card',
            paymentProof: data.paymentProof || undefined,
            transactionId: data.transactionId || undefined,
            status: data.status || 'processing',
            createdAt: data.createdAt || 'Recent',
            updatedAt: data.updatedAt || undefined,
            licenseKey: data.licenseKey || creds?.licenseKey || undefined,
            accountEmail: data.accountEmail || creds?.accountEmail || undefined,
            deliveryInstructions: data.deliveryInstructions || creds?.instructions || undefined,
            credentials: creds,
            isNew: data.isNew ?? false,
          });
        });

        // Sort by recency
        ordersList.sort((a, b) => {
          const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return timeB - timeA;
        });

        onOrdersUpdated(ordersList);
      },
      (error) => {
        console.warn('[Firestore] Orders snapshot listener warning:', error);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('[Firestore] Error subscribing to orders:', err);
    return () => {};
  }
}

/**
 * Updates an order status or credentials in Firestore in real-time.
 */
export async function firestoreUpdateOrder(
  orderId: string,
  updates: Partial<CustomerOrder>
): Promise<void> {
  try {
    const orderDocRef = doc(db, ORDERS_COLLECTION, orderId);
    const firestoreUpdates: Record<string, any> = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    if (updates.credentials) {
      firestoreUpdates.credentials = JSON.stringify(updates.credentials);
    }
    if (updates.items) {
      firestoreUpdates.items = JSON.stringify(updates.items);
    }

    await updateDoc(orderDocRef, firestoreUpdates);
    console.log(`[Firestore] Order ${orderId} updated in cloud database.`);
  } catch (err) {
    console.warn(`[Firestore] Warning updating order ${orderId}:`, err);
  }
}

/**
 * Looks up a single order directly from Firestore for tracking.
 */
export async function firestoreGetOrder(orderId: string): Promise<CustomerOrder | null> {
  try {
    const orderDocRef = doc(db, ORDERS_COLLECTION, orderId);
    const docSnap = await getDoc(orderDocRef);
    if (!docSnap.exists()) return null;

    const data = docSnap.data();
    let parsedItems = [];
    try {
      parsedItems = typeof data.items === 'string' ? JSON.parse(data.items) : data.items || [];
    } catch {
      parsedItems = [];
    }

    let creds = undefined;
    if (data.credentials) {
      try {
        creds = typeof data.credentials === 'string' ? JSON.parse(data.credentials) : data.credentials;
      } catch {
        creds = undefined;
      }
    } else if (data.licenseKey || data.accountEmail || data.deliveryInstructions) {
      creds = {
        licenseKey: data.licenseKey || '',
        accountEmail: data.accountEmail || '',
        instructions: data.deliveryInstructions || '',
      };
    }

    return {
      orderId: data.orderId || docSnap.id,
      customerEmail: data.customerEmail || '',
      customerPhone: data.customerPhone || undefined,
      items: parsedItems,
      subtotalUSD: Number(data.subtotalUSD || 0),
      discountUSD: Number(data.discountUSD || 0),
      totalUSD: Number(data.totalUSD || 0),
      coupon: data.coupon || undefined,
      paymentMethod: data.paymentMethod || 'Credit/Debit Card',
      paymentProof: data.paymentProof || undefined,
      transactionId: data.transactionId || undefined,
      status: data.status || 'processing',
      createdAt: data.createdAt || 'Recent',
      updatedAt: data.updatedAt || undefined,
      licenseKey: data.licenseKey || creds?.licenseKey || undefined,
      accountEmail: data.accountEmail || creds?.accountEmail || undefined,
      deliveryInstructions: data.deliveryInstructions || creds?.instructions || undefined,
      credentials: creds,
      isNew: data.isNew ?? false,
    };
  } catch (err) {
    console.warn(`[Firestore] Error fetching order ${orderId}:`, err);
    return null;
  }
}

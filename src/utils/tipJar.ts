import { createContext, createElement, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import type { ExpoPurchaseError, Product, ProductOrSubscription, Purchase } from 'expo-iap';
import {
  releaseIapConnection,
  retainIapConnection,
  waitForPendingIapEnd,
} from './iapLifecycle';

const TIP_SKU = 'conjugojp_tip_small';

type TipTransactionLike = {
  purchaseToken?: string | null;
  id?: string | null;
};

function nonEmpty(value?: string | null): string | null {
  return value && value.trim().length > 0 ? value : null;
}

export function getTipTransactionKey(purchase: TipTransactionLike, platform: string): string | null {
  return nonEmpty(platform === 'ios' ? purchase.id : purchase.purchaseToken);
}

let iapModule: typeof import('expo-iap') | null = null;
try {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- optional native module, loaded only on store platforms
    iapModule = require('expo-iap');
  }
} catch {
  // Keep the tip jar optional when the module cannot load.
}

const OUTCOME_TIMEOUT_MS = 120_000;

interface TipAttempt {
  token: string;
  deadline: number;
  timeout: ReturnType<typeof setTimeout>;
}

const attempts = new Map<string, TipAttempt>();
const finishing = new Set<string>();
const finished = new Set<string>();
const attentionNotified = new Set<string>();
let playRequest: Promise<void> | undefined;

function createAttemptToken(): string {
  // Both stores can echo an opaque per-attempt marker. It contains no user data.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character =>
    Math.floor(Math.random() * (character === 'x' ? 16 : 4) + (character === 'x' ? 0 : 8)).toString(16),
  );
}

function getAttemptToken(purchase: Purchase): string | undefined {
  const token = 'appAccountToken' in purchase ? purchase.appAccountToken
    : 'obfuscatedAccountIdAndroid' in purchase ? purchase.obfuscatedAccountIdAndroid : undefined;
  return token?.toLowerCase();
}

function useTipJarController() {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(!iapModule);
  const [unsupported, setUnsupported] = useState(!iapModule);
  const activeAttempt = useRef<TipAttempt | null>(null);
  const handlers = useRef<{
    preparePurchase: () => Promise<boolean>;
    purchase: (purchase: Purchase) => Promise<void>;
    error: (error: Partial<ExpoPurchaseError> | undefined, attempt?: TipAttempt) => void;
  } | null>(null);

  const settle = useCallback((attempt: TipAttempt) => {
    if (activeAttempt.current !== attempt) return;
    clearTimeout(attempt.timeout);
    activeAttempt.current = null;
    setLoading(false);
  }, []);

  useEffect(() => {
    const iap = iapModule;
    if (!iap) return;

    const codes = iap.ErrorCode;
    let mounted = true;
    let connected = false;
    let needsProduct = true;
    let connecting: Promise<boolean> | undefined;
    let sweep: Promise<void> | undefined;
    let purchaseListener: ReturnType<typeof iap.purchaseUpdatedListener> | undefined;
    let errorListener: ReturnType<typeof iap.purchaseErrorListener> | undefined;
    retainIapConnection();

    const checkConnection = (error: unknown) => {
      const code = (error as ExpoPurchaseError | undefined)?.code;
      if (!mounted || Platform.OS !== 'android' || (code !== codes.ServiceDisconnected && code !== codes.NotPrepared)) return;
      connected = false;
      needsProduct = true;
      // Keep the displayed product so the next tap can reconnect and refresh it.
    };

    const finishTip = async (purchase: Purchase, key: string) => {
      try {
        await iap.finishTransaction({ purchase, isConsumable: true });
      } catch (error) {
        if (Platform.OS !== 'android' || (error as ExpoPurchaseError)?.code !== codes.ItemNotOwned) throw error;
        // Play can report ITEM_NOT_OWNED from stale cache data. Keep an owned
        // token retryable on the next sweep, including when this query fails.
        const owned = await iap.getAvailablePurchases();
        if (owned.some(item => item.purchaseToken === key)) throw error;
      }
    };

    const handlePurchase = async (purchase: Purchase) => {
      if (!mounted || purchase.productId !== TIP_SKU) return;
      // StoreKit history can include refunded or revoked consumables.
      if ('revocationDateIOS' in purchase && purchase.revocationDateIOS != null) return;
      const token = getAttemptToken(purchase);
      const attempt = token ? attempts.get(token) : undefined;
      if (purchase.purchaseState === 'pending') {
        if (attempt) settle(attempt);
        return;
      }
      if (purchase.purchaseState !== 'purchased') return;
      if (attempt) settle(attempt);
      const key = getTipTransactionKey(purchase, Platform.OS);
      if (!key || finished.has(key) || finishing.has(key)) return;

      finishing.add(key);
      try {
        await finishTip(purchase, key);
        finished.add(key);
        attentionNotified.delete(key);
        if (attempt) {
          attempts.delete(attempt.token);
          Alert.alert('Thank You!', 'Your support means a lot and helps keep the app free for everyone.');
        }
      } catch (error) {
        checkConnection(error);
        console.warn('Failed to finish tip transaction:', error);
        if (attempt && !attentionNotified.has(key)) {
          attentionNotified.add(key);
          Alert.alert(
            'Purchase Needs Attention',
            'Your tip was received, but we could not finish the transaction. Please reopen the app or try again later.',
          );
        }
      } finally {
        finishing.delete(key);
      }
    };
    const recover = async () => {
      try {
        const purchases = Platform.OS === 'ios'
          ? await iap.getPendingTransactionsIOS()
          : await iap.getAvailablePurchases();
        for (const purchase of purchases) {
          if (!mounted || !connected) return;
          await handlePurchase(purchase);
        }
      } catch (error) {
        checkConnection(error);
        console.warn('Failed to recover tip transactions:', error);
        if (mounted && Platform.OS === 'ios') {
          // The history query publishes verified entries even if another entry
          // fails verification. History includes unfinished consumables.
          try {
            const verified = await iap.getAvailablePurchases({
              onlyIncludeActiveItemsIOS: false,
              alsoPublishToEventListenerIOS: true,
            });
            for (const purchase of verified) await handlePurchase(purchase);
          } catch (fallbackError) {
            console.warn('Failed to query StoreKit history during tip recovery:', fallbackError);
          }
        }
      }
    };

    const loadProduct = async () => {
      if (!needsProduct) return true;
      try {
        const items: ProductOrSubscription[] | null = await iap.fetchProducts({ skus: [TIP_SKU], type: 'in-app' });
        if (!mounted || !connected) return false;
        const product = items?.find((item): item is Product => item.id === TIP_SKU && item.type === 'in-app' &&
          Boolean(item.displayPrice?.trim()) &&
          (!('productStatusAndroid' in item) || item.productStatusAndroid == null || item.productStatusAndroid === 'ok'));
        needsProduct = !product;
        setProduct(product ?? null);
        setUnavailable(needsProduct);
        return !needsProduct;
      } catch (error) {
        checkConnection(error);
        if (mounted) setUnavailable(true);
        return false;
      }
    };

    const connect = (recheck = false) => {
      if (connecting) return connecting;
      if (connected && !recheck) return Promise.resolve(true);
      connecting = (async () => {
        await waitForPendingIapEnd();
        if (!mounted) return false;
        try {
          // Receive StoreKit replays so a failed finish can be retried.
          purchaseListener ??= iap.purchaseUpdatedListener(handlePurchase, { dedupeTransactionIOS: false });
          errorListener ??= iap.purchaseErrorListener(error => handlePurchaseError(error));
        } catch {
          // The JS package resolves its native bridge lazily. Expo Go lacks it.
          setUnsupported(true);
          setUnavailable(true);
          return false;
        }
        setUnsupported(false);
        connected = await iap.initConnection();
        if (mounted && !connected) setUnavailable(true);
        return mounted && connected;
      })().catch(error => {
        connected = false;
        needsProduct = true;
        if (mounted) setUnavailable(true);
        throw error;
      }).finally(() => { connecting = undefined; });
      return connecting;
    };

    const refresh = () => {
      if (sweep || !mounted) return;
      sweep = (async () => {
        if (await connect()) await Promise.all([recover(), loadProduct()]);
      })().catch(error => {
        console.warn('Failed to connect to the tip jar store:', error);
      }).finally(() => { sweep = undefined; });
    };

    const preparePurchase = async () => {
      // Play discards its native client on disconnect. Check even if the
      // disconnect happened while idle and no error has reached JavaScript.
      return await connect(true) && await loadProduct();
    };

    function handlePurchaseError(error: Partial<ExpoPurchaseError> | undefined, attempt?: TipAttempt) {
      if (!mounted) return;
      checkConnection(error);
      const code = error?.code;
      if (error?.productId && error.productId !== TIP_SKU) return;
      const retryable = code === codes.AlreadyOwned || code === codes.ItemNotOwned || code === codes.DuplicatePurchase;
      if (retryable) refresh();
      // Store error events have no attempt marker. Only a rejection from a
      // specific request can settle that request.
      if (!attempt || attempt !== activeAttempt.current) return;
      settle(attempt);
      if (retryable || code === codes.DeferredPayment || code === codes.Pending) return;
      attempts.delete(attempt.token);
      if (code === codes.UserCancelled || code === codes.PurchaseVerificationFinished) return;
      Alert.alert('Purchase Failed', 'Something went wrong. Please try again.');
    }

    handlers.current = { preparePurchase, purchase: handlePurchase, error: handlePurchaseError };
    refresh();
    const appState = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      const attempt = activeAttempt.current;
      if (attempt && attempt.deadline <= Date.now()) settle(attempt);
      refresh();
    });

    const attemptRef = activeAttempt;
    return () => {
      mounted = false;
      handlers.current = null;
      appState.remove();
      purchaseListener?.remove();
      errorListener?.remove();
      if (attemptRef.current) clearTimeout(attemptRef.current.timeout);
      attemptRef.current = null;
      releaseIapConnection(purchaseListener ? iap.endConnection : undefined);
    };
  }, [settle]);

  const tip = useCallback(async (sku: string) => {
    const handler = handlers.current;
    if (!iapModule || !handler || !product || sku !== TIP_SKU || activeAttempt.current) return;
    const token = createAttemptToken();
    const attempt: TipAttempt = {
      token,
      deadline: Date.now() + OUTCOME_TIMEOUT_MS,
      timeout: setTimeout(() => settle(attempt), OUTCOME_TIMEOUT_MS),
    };
    activeAttempt.current = attempt;
    setLoading(true);
    try {
      const isAndroid = Platform.OS === 'android';
      if (isAndroid) {
        // Expo IAP 6.6 shares pending Android purchase promises. Let the
        // old native request drain after a watchdog timeout before starting
        // another, so the old request cannot reject the new one.
        if (playRequest) await playRequest;
        if (attempt !== activeAttempt.current) return;
        const ready = await handler.preparePurchase();
        if (attempt !== activeAttempt.current) return;
        if (!ready) {
          settle(attempt);
          return;
        }
      }
      attempts.set(token, attempt);
      const request = iapModule.requestPurchase({
        request: {
          apple: { sku: TIP_SKU, appAccountToken: token },
          google: { skus: [TIP_SKU], obfuscatedAccountId: token },
        },
        type: 'in-app',
      });
      if (isAndroid) {
        const settled = request.then(() => undefined, () => undefined);
        playRequest = settled;
        void settled.then(() => {
          if (playRequest === settled) playRequest = undefined;
        });
      }
      const result = await request;
      const purchases = Array.isArray(result) ? result : result ? [result] : [];
      // The store can return no receipt for a deferred payment. Keep its
      // marker so a later receipt still gets a thank-you.
      if (purchases.length === 0) settle(attempt);
      const tipPurchases = purchases.filter(item => item.productId === TIP_SKU &&
        (item.purchaseState === 'purchased' || item.purchaseState === 'pending'));
      // Play can return an already-owned receipt in place of a new purchase.
      if (tipPurchases.length > 0 && !tipPurchases.some(purchase => getAttemptToken(purchase) === token)) {
        settle(attempt);
        attempts.delete(token);
      }
      for (const purchase of purchases) await handlers.current?.purchase(purchase);
    } catch (error) {
      handlers.current?.error(error as ExpoPurchaseError | undefined, attempt);
    }
  }, [product, settle]);

  return { products: product ? [product] : [], loading, unavailable, unsupported, tip };
}

const TipJarContext = createContext<ReturnType<typeof useTipJarController> | null>(null);

export function TipJarProvider({ children }: { children: ReactNode }) {
  const tipJar = useTipJarController();
  return createElement(TipJarContext.Provider, { value: tipJar }, children);
}

export function useTipJar() {
  const tipJar = useContext(TipJarContext);
  if (!tipJar) throw new Error('TipJarProvider is required');
  return tipJar;
}

import { createContext, createElement, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import type { ExpoPurchaseError, Product, ProductOrSubscription, Purchase } from 'expo-iap';

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

const STORE_STEP_TIMEOUT_MS = 30_000;
const FINISH_TIMEOUT_MS = 120_000;
const IOS_OUTCOME_TIMEOUT_MS = 120_000;
// OpenIAP's PURCHASE_FLOW_TIMEOUT_MILLIS sets a 15-minute timer at Play flow
// launch. If reconciliation finds no purchase at expiry, it reports service-timeout.
// Recheck the limit when upgrading expo-iap to keep this backstop longer.
const PLAY_REQUEST_TIMEOUT_MS = 16 * 60_000;

interface TipAttempt {
  token: string;
  receiptReceived: boolean;
  pendingReceipt?: boolean;
  deadline?: number;
  timeout?: ReturnType<typeof setTimeout>;
}

interface PlayRequest {
  attempt: TipAttempt;
  expired: boolean;
  timeout: ReturnType<typeof setTimeout>;
}

function createTipSession() {
  return {
    attempts: new Map<string, TipAttempt>(),
    finishing: new Map<string, TipAttempt | undefined>(),
    finished: new Set<string>(),
    attentionNotified: new Set<string>(),
    playRequest: undefined as PlayRequest | undefined,
    onChange: undefined as (() => void) | undefined,
    onRequestError: undefined as ((
      error: unknown, attempt: TipAttempt, wasActive: boolean, playExpired?: boolean,
    ) => void) | undefined,
  };
}

let tipSession = createTipSession();

export function __resetTipSessionForTests() {
  clearTimeout(tipSession.playRequest?.timeout);
  tipSession = createTipSession();
}

async function withStoreTimeout<T>(operation: Promise<T>, timeoutMs = STORE_STEP_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Tip jar store operation timed out')), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

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
  const handlers = useRef<{
    tip: (sku: string) => Promise<void>;
    retryIfUnavailable: () => void;
  } | null>(null);

  useEffect(() => {
    const iap = iapModule;
    if (!iap) return;

    const session = tipSession;
    const { attempts, finishing, finished, attentionNotified } = session;
    const isAndroid = Platform.OS === 'android';
    const codes = iap.ErrorCode;
    // Both stores: sku-not-found, item-unavailable, developer-error, feature-not-supported.
    // Play also returns billing-unavailable. StoreKit also returns iap-not-available.
    // In expo-iap 6.6.0 / OpenIAP 4.3.0 these purchase codes mean a lookup,
    // request validation, or store refusal prevented payment, even with the sheet open.
    // Re-check the store mappings and purchase paths on an expo-iap upgrade.
    const certainRefusalCodes = new Set([
      codes.SkuNotFound,
      codes.ItemUnavailable,
      codes.DeveloperError,
      codes.FeatureNotSupported,
      isAndroid ? codes.BillingUnavailable : codes.IapNotAvailable,
    ]);
    let mounted = true;
    let connected = false;
    let product: Product | null = null;
    let productUnavailable = false;
    let needsProduct = true;
    let activeAttempt: TipAttempt | undefined;
    let markedReceiptCount = 0;
    let connecting: Promise<boolean> | undefined;
    let refreshing = false;
    let reloadQueued = false;
    let sweep: Promise<void> | undefined;
    let recoveryQueued = false;
    let purchaseListener: ReturnType<typeof iap.purchaseUpdatedListener> | undefined;
    let errorListener: ReturnType<typeof iap.purchaseErrorListener> | undefined;

    const playBlocked = () => {
      const request = session.playRequest;
      // A marked receipt can arrive before the shared native promise drains.
      return Boolean(request && (request.attempt.receiptReceived || request.expired));
    };
    const isFinishingMarkedTip = () => Array.from(finishing).some(([key, attempt]) => attempt && !finished.has(key));
    const isBusy = () => Boolean(activeAttempt || (session.playRequest && !playBlocked()) || isFinishingMarkedTip());
    const sync = () => {
      setLoading(isBusy());
      setUnavailable(productUnavailable || playBlocked());
    };
    session.onChange = sync;
    sync();

    const markProductUnavailable = () => {
      productUnavailable = true;
      needsProduct = true;
      sync();
    };

    const settle = (attempt: TipAttempt) => {
      if (activeAttempt !== attempt) return;
      clearTimeout(attempt.timeout);
      activeAttempt = undefined;
      sync();
    };

    const checkConnection = (error: unknown) => {
      const code = (error as ExpoPurchaseError | undefined)?.code;
      if (!mounted || !isAndroid || (code !== codes.ServiceDisconnected && code !== codes.NotPrepared)) return false;
      connected = false;
      needsProduct = true;
      // Keep the displayed product so the next tap can reconnect and refresh it.
      return true;
    };

    const finishTip = async (purchase: Purchase, key: string) => {
      try {
        await iap.finishTransaction({ purchase, isConsumable: true });
      } catch (error) {
        if (!isAndroid || (error as ExpoPurchaseError)?.code !== codes.ItemNotOwned) throw error;
        // Play can report ITEM_NOT_OWNED from stale cache data. Keep an owned
        // token retryable on the next sweep, including when this query fails.
        const owned = await iap.getAvailablePurchases();
        if (owned.some(item => item.purchaseToken === key)) throw error;
      }
    };

    const claimPurchase = (purchase: Purchase) => {
      if (!mounted || purchase.productId !== TIP_SKU) return;
      // StoreKit history can include refunded or revoked consumables.
      if ('revocationDateIOS' in purchase && purchase.revocationDateIOS != null) return;
      const token = getAttemptToken(purchase);
      const attempt = token ? attempts.get(token) : undefined;
      if (purchase.purchaseState === 'pending') {
        if (attempt && !attempt.receiptReceived) {
          attempt.pendingReceipt = true;
          settle(attempt);
        }
        return;
      }
      if (purchase.purchaseState !== 'purchased') return;
      const key = getTipTransactionKey(purchase, Platform.OS);
      if (!key || finished.has(key) || finishing.has(key)) return;

      finishing.set(key, attempt);
      if (attempt) {
        markedReceiptCount += 1;
        attempt.receiptReceived = true;
        settle(attempt);
      }
      sync();
      return async () => {
        try {
          if (!mounted || finished.has(key)) return;
          // Observe a late success even after the timeout makes this key retryable.
          await withStoreTimeout(finishTip(purchase, key).then(() => {
            if (finished.has(key)) return;
            finished.add(key);
            attentionNotified.delete(key);
            if (attempt) {
              attempts.delete(attempt.token);
              if (mounted) Alert.alert('Thank You!', 'Your support means a lot and helps keep the app free for everyone.');
            }
            session.onChange?.();
          }), FINISH_TIMEOUT_MS);
        } catch (error) {
          if (!mounted || finished.has(key)) return;
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
          session.onChange?.();
        }
      };
    };

    const handlePurchase = async (purchase: Purchase) => claimPurchase(purchase)?.();

    const recoverPurchases = async (query: Promise<Purchase[]>) => {
      // A timed-out query can still return a charged receipt. Handle its result
      // even if another sweep has since started or the connection went stale.
      const handling = query.then(async purchases => {
        // Lock the whole batch before any finish can hold up a marked receipt.
        const finishes = purchases.map(claimPurchase);
        for (const finish of finishes) await finish?.();
      }, () => undefined);
      await withStoreTimeout(query);
      await handling;
    };

    const recover = async (retryDisconnect = true): Promise<void> => {
      try {
        await recoverPurchases(isAndroid
          ? iap.getAvailablePurchases()
          : iap.getPendingTransactionsIOS());
      } catch (error) {
        if (checkConnection(error) && retryDisconnect && await connect()) {
          await recover(false);
          return;
        }
        console.warn('Failed to recover tip transactions:', error);
        if (mounted && Platform.OS === 'ios') {
          // The history query publishes verified entries even if another entry
          // fails verification. History includes unfinished consumables.
          try {
            await recoverPurchases(iap.getAvailablePurchases({
              onlyIncludeActiveItemsIOS: false,
              alsoPublishToEventListenerIOS: true,
            }));
          } catch (fallbackError) {
            console.warn('Failed to query StoreKit history during tip recovery:', fallbackError);
          }
        }
      }
    };

    const loadProduct = async (recheck = false) => {
      if (!needsProduct && !recheck) return true;
      try {
        const items: ProductOrSubscription[] | null = await withStoreTimeout(iap.fetchProducts({ skus: [TIP_SKU], type: 'in-app' }));
        if (!mounted) return false;
        const loadedProduct = items?.find((item): item is Product => item.id === TIP_SKU && item.type === 'in-app' &&
          Boolean(item.displayPrice?.trim()) &&
          (!('productStatusAndroid' in item) || item.productStatusAndroid == null || item.productStatusAndroid === 'ok'));
        if (!loadedProduct) {
          markProductUnavailable();
          return false;
        }
        product = loadedProduct;
        setProduct(loadedProduct);
        productUnavailable = false;
        needsProduct = !connected;
        sync();
        return connected;
      } catch (error) {
        checkConnection(error);
        if (mounted) markProductUnavailable();
        return false;
      }
    };

    const connect = (recheck = false) => {
      if (connecting) return connecting;
      if (connected && !recheck) return Promise.resolve(true);
      connecting = (async () => {
        try {
          // Receive StoreKit replays so a failed finish can be retried.
          purchaseListener ??= iap.purchaseUpdatedListener(handlePurchase, { dedupeTransactionIOS: false });
          errorListener ??= iap.purchaseErrorListener(error => handlePurchaseError(error));
        } catch {
          // The JS package resolves its native bridge lazily. Expo Go lacks it.
          setUnsupported(true);
          markProductUnavailable();
          return false;
        }
        setUnsupported(false);
        connected = await withStoreTimeout(iap.initConnection());
        if (mounted && !connected) markProductUnavailable();
        return mounted && connected;
      })().catch(error => {
        connected = false;
        if (mounted) markProductUnavailable();
        throw error;
      }).finally(() => { connecting = undefined; });
      return connecting;
    };

    const sweepPurchases = () => {
      if (!mounted) return;
      if (sweep) {
        recoveryQueued = true;
        return;
      }
      sweep = (async () => {
        if (await connect()) await recover();
      })().catch(error => {
        console.warn('Failed to reconnect during tip recovery:', error);
      }).finally(() => {
        sweep = undefined;
        if (recoveryQueued) {
          recoveryQueued = false;
          sweepPurchases();
        }
      });
    };

    const refresh = (forceProduct = false) => {
      if (!mounted) return;
      if (refreshing) {
        reloadQueued = true;
        return;
      }
      refreshing = true;
      void (async () => {
        try {
          if (!(await connect(isAndroid))) return;
          sweepPurchases();
          await loadProduct(forceProduct);
        } catch (error) {
          console.warn('Failed to connect to the tip jar store:', error);
        } finally {
          refreshing = false;
          if (reloadQueued) {
            reloadQueued = false;
            refresh(true);
          }
        }
      })();
    };

    const preparePurchase = async () => {
      try {
        // A successful init may have replaced a disconnected Play client.
        // Always load the product on the client that will handle the purchase.
        if (await connect(true) && await loadProduct(true)) return true;
      } catch (error) {
        console.warn('Failed to prepare the tip jar store:', error);
      }
      if (mounted) markProductUnavailable();
      return false;
    };

    function handlePurchaseError(
      rejection: unknown,
      attempt?: TipAttempt,
      wasActive = false,
      playExpired = false,
    ) {
      if (!mounted) return;
      const error = rejection as Partial<ExpoPurchaseError> | undefined;
      checkConnection(error);
      const code = error?.code;
      if (playExpired) {
        refresh();
        return;
      }
      if (error?.productId && error.productId !== TIP_SKU) {
        if (attempt && !attempt.receiptReceived) refresh();
        return;
      }
      if (code === codes.AlreadyOwned || code === codes.ItemNotOwned || code === codes.DuplicatePurchase) {
        refresh();
        return;
      }
      // Store error events have no attempt marker. Only a rejection from a
      // specific request can settle that request.
      if (!attempt || attempt.receiptReceived) return;
      if (attempt.pendingReceipt || code === undefined || !certainRefusalCodes.has(code)) {
        refresh();
        return;
      }
      if (!wasActive) return;
      attempts.delete(attempt.token);
      Alert.alert('Purchase Failed', 'Something went wrong. Please try again.');
    }

    const tip = async (sku: string) => {
      if (!product || productUnavailable || sku !== TIP_SKU || session.playRequest || isBusy()) return;
      const token = createAttemptToken();
      const attempt: TipAttempt = { token, receiptReceived: false };
      activeAttempt = attempt;
      sync();
      if (isAndroid) {
        // An earlier marked receipt can arrive and finish during preparation.
        const receiptsBeforePreparation = markedReceiptCount;
        const ready = await preparePurchase();
        if (!mounted) return;
        if (!ready || markedReceiptCount !== receiptsBeforePreparation || isFinishingMarkedTip()) {
          settle(attempt);
          return;
        }
        // Expo IAP can settle every pending Play promise with one answer.
        // Keep this guard until the native promise drains, even after UI expiry.
        const request: PlayRequest = {
          attempt,
          expired: false,
          timeout: setTimeout(() => {
            request.expired = true;
            session.onChange?.();
          }, PLAY_REQUEST_TIMEOUT_MS),
        };
        session.playRequest = request;
        settle(attempt);
      } else {
        attempt.deadline = Date.now() + IOS_OUTCOME_TIMEOUT_MS;
        attempt.timeout = setTimeout(() => settle(attempt), IOS_OUTCOME_TIMEOUT_MS);
      }
      attempts.set(token, attempt);
      const releaseRequest = () => {
        if (session.playRequest?.attempt === attempt) {
          clearTimeout(session.playRequest.timeout);
          session.playRequest = undefined;
          session.onChange?.();
        }
        if (mounted) settle(attempt);
      };
      let result: Purchase | Purchase[] | null;
      try {
        result = await iap.requestPurchase({
          request: {
            apple: { sku: TIP_SKU, appAccountToken: token },
            google: { skus: [TIP_SKU], obfuscatedAccountId: token },
          },
          type: 'in-app',
        });
      } catch (error) {
        const playRequest = session.playRequest?.attempt === attempt ? session.playRequest : undefined;
        const wasActive = mounted && (activeAttempt === attempt || Boolean(playRequest));
        releaseRequest();
        // A request can drain after the provider has been replaced.
        session.onRequestError?.(error, attempt, wasActive, playRequest?.expired);
        return;
      }
      const purchases = Array.isArray(result) ? result : result ? [result] : [];
      const tipPurchases = purchases.filter(item => item.productId === TIP_SKU &&
        (item.purchaseState === 'purchased' || item.purchaseState === 'pending'));
      const markedPurchases = tipPurchases.filter(purchase => getAttemptToken(purchase) === token);
      // Acquire finish locks before releasing the request, including a receipt
      // from an older marked attempt returned in place of this purchase.
      const finishes = tipPurchases.map(handlePurchase);

      // Keep markers after empty results so a late receipt can be thanked.
      if (!attempt.receiptReceived && tipPurchases.length > 0 && markedPurchases.length === 0) {
        attempts.delete(token);
      }
      releaseRequest();
      await Promise.all(finishes);
    };

    handlers.current = {
      tip,
      retryIfUnavailable: () => { if (!connected || needsProduct || playBlocked()) refresh(true); },
    };
    session.onRequestError = handlePurchaseError;
    refresh();
    const appState = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      if (activeAttempt?.deadline && activeAttempt.deadline <= Date.now()) settle(activeAttempt);
      sync();
      refresh(productUnavailable || playBlocked());
    });

    return () => {
      mounted = false;
      handlers.current = null;
      if (session.onChange === sync) session.onChange = undefined;
      if (session.onRequestError === handlePurchaseError) session.onRequestError = undefined;
      appState.remove();
      purchaseListener?.remove();
      errorListener?.remove();
      clearTimeout(activeAttempt?.timeout);
      // Keep the native connection across provider resets. Both stores can
      // block a new init behind a stalled native endConnection.
    };
  }, []);

  const retryIfUnavailable = useCallback(() => handlers.current?.retryIfUnavailable(), []);
  const tip = useCallback(async (sku: string) => { await handlers.current?.tip(sku); }, []);

  return { products: product ? [product] : [], loading, unavailable, unsupported, tip, retryIfUnavailable };
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

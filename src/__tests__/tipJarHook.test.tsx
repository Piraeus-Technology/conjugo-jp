import { Alert, AppState, Platform } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { __resetTipSessionForTests, TipJarProvider, useTipJar } from '../utils/tipJar';
import { __resetIapLifecycleForTests } from '../utils/iapLifecycle';

jest.mock('expo-iap', () => ({
  initConnection: jest.fn().mockResolvedValue(true),
  endConnection: jest.fn().mockResolvedValue(true),
  fetchProducts: jest.fn().mockResolvedValue([{ id: 'conjugojp_tip_small', type: 'in-app', displayPrice: '$0.99' }]),
  getAvailablePurchases: jest.fn().mockResolvedValue([]),
  getPendingTransactionsIOS: jest.fn().mockResolvedValue([]),
  requestPurchase: jest.fn().mockResolvedValue(null),
  finishTransaction: jest.fn().mockResolvedValue(undefined),
  purchaseUpdatedListener: jest.fn(() => ({ remove: jest.fn() })),
  purchaseErrorListener: jest.fn(() => ({ remove: jest.fn() })),
  ErrorCode: {
    UserCancelled: 'user-cancelled',
    DeferredPayment: 'deferred-payment',
    Pending: 'pending',
    DuplicatePurchase: 'duplicate-purchase',
    ItemNotOwned: 'item-not-owned',
    PurchaseVerificationFinished: 'purchase-verification-finished',
    AlreadyOwned: 'already-owned',
    NotPrepared: 'not-prepared',
    ServiceDisconnected: 'service-disconnected',
    ServiceTimeout: 'service-timeout',
  },
}));

const iap = jest.requireMock('expo-iap');
const sku = 'conjugojp_tip_small';
const os = Platform.OS;

function receipt(id: string, marker?: string) {
  const common = { id, productId: sku, purchaseState: 'purchased' };
  return Platform.OS === 'android'
    ? { ...common, purchaseToken: 'play-' + id, obfuscatedAccountIdAndroid: marker }
    : { ...common, appAccountToken: marker };
}

function publish(purchase: object): Promise<void> {
  return iap.purchaseUpdatedListener.mock.lastCall[0](purchase);
}

function publishError(code: string) {
  iap.purchaseErrorListener.mock.lastCall[0]({ code, productId: sku });
}

function requestMarker(): string {
  const { apple, google } = iap.requestPurchase.mock.lastCall[0].request;
  return Platform.OS === 'android' ? google.obfuscatedAccountId : apple.appAccountToken;
}

function foreground() {
  const listener = jest.mocked(AppState.addEventListener).mock.lastCall?.[1];
  if (!listener) throw new Error('Expected an app state listener');
  return act(async () => { listener('active'); });
}

async function loadTipJar() {
  const hook = renderHook(useTipJar, { wrapper: TipJarProvider });
  await waitFor(() => expect(hook.result.current.products).toHaveLength(1));
  return hook;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
});

afterEach(() => {
  __resetTipSessionForTests();
  jest.useRealTimers();
  jest.restoreAllMocks();
  Platform.OS = os;
  __resetIapLifecycleForTests();
});

test('registers tip listeners before connecting, loads the tip SKU, ignores other products, and alerts on a purchase error', async () => {
  const { result } = await loadTipJar();
  expect(iap.purchaseUpdatedListener).toHaveBeenCalledTimes(1);
  expect(iap.purchaseUpdatedListener).toHaveBeenCalledWith(expect.any(Function), { dedupeTransactionIOS: false });
  expect(iap.purchaseUpdatedListener.mock.invocationCallOrder[0]).toBeLessThan(iap.initConnection.mock.invocationCallOrder[0]);
  expect(iap.purchaseErrorListener).toHaveBeenCalledTimes(1);
  expect(iap.purchaseErrorListener.mock.invocationCallOrder[0]).toBeLessThan(iap.initConnection.mock.invocationCallOrder[0]);
  expect(iap.fetchProducts).toHaveBeenCalledWith({ skus: [sku], type: 'in-app' });
  expect(result.current.products[0].displayPrice).toBe('$0.99');

  await act(async () => publish({ ...receipt('other'), productId: 'other_product' }));
  expect(iap.finishTransaction).not.toHaveBeenCalled();
  iap.requestPurchase.mockRejectedValueOnce({ code: 'network-error' });
  await act(async () => result.current.tip(sku));
  expect(Alert.alert).toHaveBeenCalledWith('Purchase Failed', 'Something went wrong. Please try again.');
  expect(result.current.loading).toBe(false);
});

test.each(['ios', 'android'] as const)('blocks repeat %s taps until the tip is finished and thanked', async platform => {
  Platform.OS = platform;
  let resolveRequest!: (purchase: object) => void;
  let resolveFinish!: () => void;
  iap.requestPurchase.mockImplementationOnce(() => new Promise(resolve => { resolveRequest = resolve; }));
  iap.finishTransaction.mockImplementationOnce(() => new Promise<void>(resolve => { resolveFinish = resolve; }));
  const { result } = await loadTipJar();
  let request!: Promise<void>;
  await act(async () => {
    request = result.current.tip(sku);
    void result.current.tip(sku);
  });
  expect(iap.requestPurchase).toHaveBeenCalledTimes(1);
  const purchase = receipt('held-finish-' + platform, requestMarker());
  expect(result.current.loading).toBe(true);

  let finishing!: Promise<void>;
  await act(async () => { finishing = publish(purchase); });
  expect(iap.finishTransaction).toHaveBeenCalledWith({ purchase, isConsumable: true });
  await act(async () => { resolveRequest(purchase); await request; });
  expect(result.current.loading).toBe(true);
  await act(async () => result.current.tip(sku));
  expect(iap.requestPurchase).toHaveBeenCalledTimes(1);
  expect(Alert.alert).not.toHaveBeenCalled();

  await act(async () => { resolveFinish(); await finishing; });
  expect(result.current.loading).toBe(false);
  expect(Alert.alert).toHaveBeenCalledTimes(1);
  expect(Alert.alert).toHaveBeenCalledWith('Thank You!', expect.any(String));
  expect(iap.finishTransaction).toHaveBeenCalledTimes(1);
  await act(async () => result.current.tip(sku));
  expect(iap.requestPurchase).toHaveBeenCalledTimes(2);
});

test.each(['ios', 'android'] as const)('ends a %s cancellation quietly', async platform => {
  Platform.OS = platform;
  const { result } = await loadTipJar();
  iap.requestPurchase.mockRejectedValueOnce({ code: 'user-cancelled' });
  await act(async () => result.current.tip(sku));
  expect(iap.requestPurchase).toHaveBeenCalledTimes(1);
  expect(result.current.loading).toBe(false);
  expect(Alert.alert).not.toHaveBeenCalled();
});

test('alerts Purchase Failed for an ordinary Android store error', async () => {
  Platform.OS = 'android';
  const { result } = await loadTipJar();
  iap.requestPurchase.mockRejectedValueOnce({ code: 'network-error' });
  await act(async () => result.current.tip(sku));
  expect(result.current.loading).toBe(false);
  expect(Alert.alert).toHaveBeenCalledTimes(1);
  expect(Alert.alert).toHaveBeenCalledWith('Purchase Failed', 'Something went wrong. Please try again.');
});

test('recovers quietly from an Android service timeout and thanks once for the later marked receipt', async () => {
  Platform.OS = 'android';
  const { result } = await loadTipJar();
  let resolveSweep!: (purchases: object[]) => void;
  iap.getAvailablePurchases.mockImplementationOnce(() => new Promise(resolve => { resolveSweep = resolve; }));
  iap.requestPurchase.mockRejectedValueOnce({ code: 'service-timeout' });
  await act(async () => result.current.tip(sku));
  expect(result.current.loading).toBe(false);
  expect(Alert.alert).not.toHaveBeenCalled();

  const purchase = receipt('play-timeout', requestMarker());
  await act(async () => resolveSweep([purchase]));
  await act(async () => publish(purchase));
  expect(iap.finishTransaction).toHaveBeenCalledTimes(1);
  expect(iap.finishTransaction).toHaveBeenCalledWith({ purchase, isConsumable: true });
  expect(Alert.alert).toHaveBeenCalledTimes(1);
  expect(Alert.alert).toHaveBeenCalledWith('Thank You!', expect.any(String));
});

test('keeps the Play button busy past two minutes and ends a later cancellation quietly', async () => {
  Platform.OS = 'android';
  const { result } = await loadTipJar();
  jest.useFakeTimers();
  let cancel!: (error: object) => void;
  iap.requestPurchase.mockImplementationOnce(() => new Promise((_resolve, reject) => { cancel = reject; }));
  let request!: Promise<void>;
  await act(async () => { request = result.current.tip(sku); });
  expect(iap.requestPurchase).toHaveBeenCalledTimes(1);

  act(() => jest.advanceTimersByTime(121_000));
  expect(result.current.loading).toBe(true);
  expect(result.current.unavailable).toBe(false);
  await act(async () => result.current.tip(sku));
  expect(iap.requestPurchase).toHaveBeenCalledTimes(1);
  expect(Alert.alert).not.toHaveBeenCalled();

  await act(async () => { cancel({ code: 'user-cancelled' }); await request; });
  expect(result.current.loading).toBe(false);
  expect(result.current.unavailable).toBe(false);
  expect(Alert.alert).not.toHaveBeenCalled();
});

test('applies the Play backstop despite a slow wall clock and recovers quietly after a late rejection', async () => {
  Platform.OS = 'android';
  const { result } = await loadTipJar();
  jest.useFakeTimers();
  const wallClockDeadline = Date.now() + 16 * 60_000;
  let rejectRequest!: (error: object) => void;
  iap.requestPurchase.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectRequest = reject; }));
  let request!: Promise<void>;
  await act(async () => { request = result.current.tip(sku); });

  act(() => jest.advanceTimersByTime(15 * 60_000));
  expect(result.current.loading).toBe(true);
  const wallClock = jest.spyOn(Date, 'now').mockReturnValue(wallClockDeadline - 1);
  act(() => jest.advanceTimersByTime(60_000));
  expect(result.current.loading).toBe(false);
  expect(result.current.unavailable).toBe(true);
  wallClock.mockRestore();
  let fetches = iap.fetchProducts.mock.calls.length;
  await act(async () => result.current.retryIfUnavailable());
  expect(iap.fetchProducts).toHaveBeenCalledTimes(fetches + 1);
  fetches += 1;
  await foreground();
  expect(iap.fetchProducts).toHaveBeenCalledTimes(fetches + 1);
  expect(result.current.unavailable).toBe(true);
  await act(async () => result.current.tip(sku));
  expect(iap.requestPurchase).toHaveBeenCalledTimes(1);
  expect(Alert.alert).not.toHaveBeenCalled();

  const purchase = receipt('play-backstop', requestMarker());
  iap.getAvailablePurchases.mockResolvedValueOnce([purchase]);
  await act(async () => { rejectRequest({ code: 'network-error' }); await request; });
  expect(result.current.loading).toBe(false);
  expect(result.current.unavailable).toBe(false);
  expect(iap.finishTransaction).toHaveBeenCalledWith({ purchase, isConsumable: true });
  expect(Alert.alert).toHaveBeenCalledTimes(1);
  expect(Alert.alert).toHaveBeenCalledWith('Thank You!', expect.any(String));
  iap.requestPurchase.mockImplementationOnce(() => new Promise(() => {}));
  await act(async () => { void result.current.tip(sku); });
  expect(iap.requestPurchase).toHaveBeenCalledTimes(2);
});

test('releases a stalled Play product reload and recovers on the next More focus', async () => {
  Platform.OS = 'android';
  const { result } = await loadTipJar();
  jest.useFakeTimers();
  iap.fetchProducts.mockImplementationOnce(() => new Promise(() => {}));
  let request!: Promise<void>;
  await act(async () => { request = result.current.tip(sku); });
  expect(iap.fetchProducts).toHaveBeenCalledTimes(2);
  expect(result.current.loading).toBe(true);

  await act(async () => { jest.advanceTimersByTime(30_000); await request; });
  expect(result.current.loading).toBe(false);
  expect(result.current.unavailable).toBe(true);
  expect(iap.requestPurchase).not.toHaveBeenCalled();
  await act(async () => result.current.retryIfUnavailable());
  expect(iap.fetchProducts).toHaveBeenCalledTimes(3);
  expect(result.current.unavailable).toBe(false);
});

test('retries a failed launch product load after More focuses while the sweep is running', async () => {
  Platform.OS = 'android';
  let resolveSweep!: (purchases: object[]) => void;
  let resolveProduct!: (products: object[]) => void;
  iap.getAvailablePurchases.mockImplementationOnce(() => new Promise(resolve => { resolveSweep = resolve; }));
  iap.fetchProducts.mockImplementationOnce(() => new Promise(resolve => { resolveProduct = resolve; }));
  const { result } = renderHook(useTipJar, { wrapper: TipJarProvider });
  await waitFor(() => {
    expect(iap.getAvailablePurchases).toHaveBeenCalledTimes(1);
    expect(iap.fetchProducts).toHaveBeenCalledTimes(1);
  });

  await act(async () => { result.current.retryIfUnavailable(); resolveProduct([]); });
  expect(iap.fetchProducts).toHaveBeenCalledTimes(2);
  expect(result.current.products[0].displayPrice).toBe('$0.99');
  expect(result.current.unavailable).toBe(false);
  await act(async () => resolveSweep([]));
});

test.each(['ios', 'android'] as const)('recovers %s tips at launch and on foreground', async platform => {
  Platform.OS = platform;
  const query = platform === 'ios' ? iap.getPendingTransactionsIOS : iap.getAvailablePurchases;
  const unfinished = receipt('launch-' + platform);
  const pending = receipt('foreground-' + platform);
  query.mockResolvedValueOnce([unfinished, { ...pending, purchaseState: 'pending' }]);
  await loadTipJar();
  expect(iap.finishTransaction).toHaveBeenCalledTimes(1);
  expect(iap.finishTransaction).toHaveBeenCalledWith({ purchase: unfinished, isConsumable: true });

  query.mockResolvedValueOnce([unfinished, pending]);
  await foreground();
  expect(iap.finishTransaction).toHaveBeenCalledTimes(2);
  expect(iap.finishTransaction).toHaveBeenLastCalledWith({ purchase: pending, isConsumable: true });
  expect(Alert.alert).not.toHaveBeenCalled();
});

test('blocks new Play taps while a marked receipt waits behind an older receipt in a recovery batch', async () => {
  Platform.OS = 'android';
  const { result } = await loadTipJar();
  await act(async () => result.current.tip(sku));
  const older = receipt('older-batch-tip');
  const marked = receipt('marked-batch-tip', requestMarker());
  let finishOlder!: () => void;
  let finishMarked!: () => void;
  iap.finishTransaction
    .mockImplementationOnce(() => new Promise<void>(resolve => { finishOlder = resolve; }))
    .mockImplementationOnce(() => new Promise<void>(resolve => { finishMarked = resolve; }));
  iap.getAvailablePurchases.mockResolvedValueOnce([older, marked]);

  await foreground();
  expect(iap.finishTransaction).toHaveBeenCalledTimes(1);
  expect(iap.finishTransaction).toHaveBeenCalledWith({ purchase: older, isConsumable: true });
  expect(result.current.loading).toBe(true);
  await act(async () => result.current.tip(sku));
  expect(iap.requestPurchase).toHaveBeenCalledTimes(1);

  await act(async () => finishOlder());
  expect(iap.finishTransaction).toHaveBeenCalledTimes(2);
  expect(iap.finishTransaction).toHaveBeenLastCalledWith({ purchase: marked, isConsumable: true });
  expect(result.current.loading).toBe(true);
  await act(async () => finishMarked());
  expect(result.current.loading).toBe(false);
  expect(Alert.alert).toHaveBeenCalledTimes(1);
  expect(Alert.alert).toHaveBeenCalledWith('Thank You!', expect.any(String));
});

test('finishes and thanks for a receipt returned after the watchdog expires', async () => {
  const { result } = await loadTipJar();
  let finish!: (purchase: object) => void;
  iap.requestPurchase.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  jest.useFakeTimers();
  let request!: Promise<void>;
  act(() => { request = result.current.tip(sku); });
  const purchase = receipt('late-returned', requestMarker().toUpperCase());
  act(() => jest.advanceTimersByTime(120_000));
  expect(result.current.loading).toBe(false);

  await act(async () => { finish(purchase); await request; });
  await act(async () => publish(purchase));
  expect(iap.finishTransaction).toHaveBeenCalledTimes(1);
  expect(iap.finishTransaction).toHaveBeenCalledWith({ purchase, isConsumable: true });
  expect(Alert.alert).toHaveBeenCalledWith('Thank You!', expect.any(String));
});

test('keeps a newer attempt active when an earlier error arrives', async () => {
  const { result } = await loadTipJar();
  jest.useFakeTimers();
  let rejectOld!: (error: object) => void;
  let resolveNew!: (purchase: object) => void;
  iap.requestPurchase
    .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectOld = reject; }))
    .mockImplementationOnce(() => new Promise(resolve => { resolveNew = resolve; }));
  let oldRequest!: Promise<void>;
  let newRequest!: Promise<void>;
  act(() => { oldRequest = result.current.tip(sku); });
  act(() => jest.advanceTimersByTime(120_000));
  act(() => { newRequest = result.current.tip(sku); });
  const purchase = receipt('new-attempt', requestMarker());

  await act(async () => {
    publishError('network-error');
    rejectOld({ code: 'network-error' });
    await oldRequest;
  });
  expect(result.current.loading).toBe(true);
  expect(Alert.alert).not.toHaveBeenCalled();
  await act(async () => { resolveNew(purchase); await newRequest; });
  expect(result.current.loading).toBe(false);
  expect(Alert.alert).toHaveBeenCalledWith('Thank You!', expect.any(String));
});

test('quietly returns on an empty Play result, reloads before the next purchase request, and thanks for the later marked receipt', async () => {
  Platform.OS = 'android';
  const { result } = await loadTipJar();
  iap.requestPurchase.mockResolvedValueOnce([]);
  await act(async () => result.current.tip(sku));
  const marker = requestMarker();
  expect(iap.requestPurchase.mock.lastCall[0].request.google).toEqual({ skus: [sku], obfuscatedAccountId: expect.any(String) });
  expect(result.current.loading).toBe(false);
  expect(Alert.alert).not.toHaveBeenCalled();

  const calls = iap.initConnection.mock.calls.length;
  const fetches = iap.fetchProducts.mock.calls.length;
  await act(async () => result.current.tip(sku));
  expect(iap.initConnection).toHaveBeenCalledTimes(calls + 1);
  expect(iap.fetchProducts).toHaveBeenCalledTimes(fetches + 1);
  expect(iap.fetchProducts.mock.invocationCallOrder.at(-1)).toBeLessThan(iap.requestPurchase.mock.invocationCallOrder.at(-1));
  expect(iap.requestPurchase).toHaveBeenCalledTimes(2);

  const purchase = receipt('play-deferred', marker);
  await act(async () => publish(purchase));
  expect(iap.finishTransaction).toHaveBeenCalledWith({ purchase, isConsumable: true });
  expect(Alert.alert).toHaveBeenCalledWith('Thank You!', expect.any(String));
});

test('discards a prepared Play tap overtaken by an earlier marked receipt and accepts a fresh tap', async () => {
  Platform.OS = 'android';
  const { result } = await loadTipJar();
  iap.requestPurchase.mockResolvedValueOnce([]);
  await act(async () => result.current.tip(sku));
  const purchase = receipt('overtaking-tip', requestMarker());
  const products = result.current.products;
  let resolveProduct!: (items: object[]) => void;
  iap.fetchProducts.mockImplementationOnce(() => new Promise(resolve => { resolveProduct = resolve; }));
  let request!: Promise<void>;
  await act(async () => { request = result.current.tip(sku); });

  await act(async () => publish(purchase));
  expect(Alert.alert).toHaveBeenCalledWith('Thank You!', expect.any(String));
  await act(async () => { resolveProduct(products); await request; });
  expect(iap.requestPurchase).toHaveBeenCalledTimes(1);
  expect(result.current.loading).toBe(false);

  await act(async () => result.current.tip(sku));
  expect(iap.requestPurchase).toHaveBeenCalledTimes(2);
});

test('finishes and thanks once when a Play disconnect event arrives during recovery after request rejection', async () => {
  Platform.OS = 'android';
  const { result } = await loadTipJar();
  let resolveSweep!: (purchases: object[]) => void;
  iap.getAvailablePurchases.mockImplementationOnce(() => new Promise(resolve => { resolveSweep = resolve; }));
  iap.requestPurchase.mockRejectedValueOnce({ code: 'service-disconnected' });
  await act(async () => result.current.tip(sku));
  expect(result.current.loading).toBe(false);
  const purchase = receipt('play-disconnect', requestMarker());
  await act(async () => {
    publishError('service-disconnected');
    resolveSweep([purchase]);
  });
  expect(Alert.alert).toHaveBeenCalledWith('Thank You!', expect.any(String));
  await act(async () => publish(purchase));
  expect(iap.finishTransaction).toHaveBeenCalledTimes(1);
  expect(iap.finishTransaction).toHaveBeenCalledWith({ purchase, isConsumable: true });
  expect(Alert.alert).not.toHaveBeenCalledWith('Purchase Failed', expect.any(String));
  expect(Alert.alert).toHaveBeenCalledTimes(1);
});

test.each(['ios', 'android'] as const)('releases a stalled %s finish with one attention alert, then retries the receipt', async platform => {
  Platform.OS = platform;
  const { result } = await loadTipJar();
  jest.useFakeTimers();
  await act(async () => result.current.tip(sku));
  expect(result.current.loading).toBe(false);
  const purchase = receipt('stalled-finish', requestMarker());
  let resolveFirst!: () => void;
  if (platform === 'android') {
    iap.finishTransaction.mockRejectedValueOnce({ code: 'item-not-owned' });
    iap.getAvailablePurchases.mockImplementationOnce(() => new Promise(resolve => { resolveFirst = () => resolve([]); }));
  } else {
    iap.finishTransaction.mockImplementationOnce(() => new Promise<void>(resolve => { resolveFirst = resolve; }));
  }
  let resolveRetry!: () => void;
  iap.finishTransaction.mockImplementationOnce(() => new Promise<void>(resolve => { resolveRetry = resolve; }));

  let firstFinish!: Promise<void>;
  await act(async () => { firstFinish = publish(purchase); });
  expect(result.current.loading).toBe(true);
  await act(async () => result.current.tip(sku));
  expect(iap.requestPurchase).toHaveBeenCalledTimes(1);
  expect(iap.finishTransaction).toHaveBeenCalledTimes(1);
  expect(Alert.alert).not.toHaveBeenCalled();

  await act(async () => { jest.advanceTimersByTime(120_000); await firstFinish; });
  expect(result.current.loading).toBe(false);
  expect(Alert.alert).toHaveBeenCalledTimes(1);
  expect(Alert.alert).toHaveBeenCalledWith('Purchase Needs Attention', expect.stringContaining('Your tip was received'));

  const query = platform === 'android' ? iap.getAvailablePurchases : iap.getPendingTransactionsIOS;
  query.mockResolvedValueOnce([purchase]);
  await foreground();
  expect(iap.finishTransaction).toHaveBeenCalledTimes(2);
  expect(iap.finishTransaction).toHaveBeenLastCalledWith({ purchase, isConsumable: true });
  expect(result.current.loading).toBe(true);

  // Exercise both completion orders, including an old success during a retry.
  const [first, second] = platform === 'ios' ? [resolveFirst, resolveRetry] : [resolveRetry, resolveFirst];
  await act(async () => first());
  expect(result.current.loading).toBe(false);
  expect(Alert.alert).toHaveBeenLastCalledWith('Thank You!', expect.any(String));
  await act(async () => second());
  await act(async () => publish(purchase));
  expect(iap.finishTransaction).toHaveBeenCalledTimes(2);
  expect(Alert.alert).toHaveBeenCalledTimes(2);
});

test('retries ItemNotOwned while Play still reports the purchase', async () => {
  Platform.OS = 'android';
  const { result } = await loadTipJar();
  await act(async () => result.current.tip(sku));
  const purchase = receipt('still-owned', requestMarker());
  iap.finishTransaction.mockRejectedValueOnce({ code: 'item-not-owned' });
  iap.getAvailablePurchases.mockResolvedValueOnce([purchase]);
  await act(async () => publish(purchase));
  expect(Alert.alert).toHaveBeenCalledWith('Purchase Needs Attention', expect.any(String));

  iap.getAvailablePurchases.mockResolvedValueOnce([purchase]);
  await foreground();
  expect(iap.finishTransaction).toHaveBeenCalledTimes(2);
  expect(Alert.alert).toHaveBeenLastCalledWith('Thank You!', expect.any(String));
});

test('recovers verified iOS receipts when the unfinished query rejects', async () => {
  Platform.OS = 'ios';
  const purchase = receipt('verified-history');
  iap.getPendingTransactionsIOS.mockRejectedValueOnce(new Error('unverified transaction'));
  iap.getAvailablePurchases.mockImplementationOnce(async () => {
    await publish(purchase);
    throw new Error('another unverified transaction');
  });
  await loadTipJar();
  expect(iap.getAvailablePurchases).toHaveBeenCalledWith({
    onlyIncludeActiveItemsIOS: false,
    alsoPublishToEventListenerIOS: true,
  });
  expect(iap.finishTransaction).toHaveBeenCalledWith({ purchase, isConsumable: true });
});

import { Alert } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useTipJar } from '../utils/tipJar';
import { __resetIapLifecycleForTests } from '../utils/iapLifecycle';

jest.mock('react-native-iap', () => ({
  initConnection: jest.fn().mockResolvedValue(true),
  endConnection: jest.fn().mockResolvedValue(undefined),
  fetchProducts: jest.fn().mockResolvedValue([{ id: 'conjugojp_tip_small', type: 'in-app', price: 0.99 }]),
  getAvailablePurchases: jest.fn().mockResolvedValue([]),
  requestPurchase: jest.fn().mockResolvedValue(undefined),
  finishTransaction: jest.fn().mockResolvedValue(undefined),
  purchaseUpdatedListener: jest.fn(() => ({ remove: jest.fn() })),
  purchaseErrorListener: jest.fn(() => ({ remove: jest.fn() })),
  ErrorCode: { UserCancelled: 'E_USER_CANCELLED' },
}));

test('tip jar matches ES listener, SKU, and purchase-start recovery behavior', async () => {
  const iap = jest.requireMock('react-native-iap');
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const hook = renderHook(() => useTipJar());
  try {
    await waitFor(() => expect(hook.result.current.products).toHaveLength(1));
    expect(iap.purchaseUpdatedListener).toHaveBeenCalledTimes(2);
    expect(iap.initConnection.mock.invocationCallOrder[0]).toBeLessThan(iap.purchaseUpdatedListener.mock.invocationCallOrder[1]);
    expect(iap.purchaseErrorListener).toHaveBeenCalledTimes(2);
    const handler = iap.purchaseUpdatedListener.mock.calls[1][0];
    await act(async () => { await handler({ productId: 'other_product', transactionId: 'other' }); });
    expect(iap.finishTransaction).not.toHaveBeenCalled();
    const purchase = { productId: 'conjugojp_tip_small', transactionId: 'tip' };
    await act(async () => { await handler(purchase); });
    expect(iap.finishTransaction).toHaveBeenCalledWith({ purchase, isConsumable: true });

    alert.mockClear();
    iap.requestPurchase.mockRejectedValueOnce({ code: 'E_NETWORK_ERROR' });
    await act(async () => { await hook.result.current.tip('conjugojp_tip_small'); });
    expect(alert).toHaveBeenCalledWith('Purchase Failed', 'Something went wrong. Please try again.');
    expect(hook.result.current.loading).toBe(false);
    alert.mockClear();
    iap.requestPurchase.mockRejectedValueOnce({ code: 'E_USER_CANCELLED' });
    await act(async () => { await hook.result.current.tip('conjugojp_tip_small'); });
    expect(alert).not.toHaveBeenCalled();
  } finally {
    hook.unmount();
    __resetIapLifecycleForTests();
    alert.mockRestore();
    warn.mockRestore();
  }
});

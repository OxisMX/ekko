import { createContext, useCallback, useContext } from 'react'
import { parseRpcError } from '@ekko/shared'

// AdminLayout provides this: opens P-04 over the current section (without unmounting it) and
// resolves once the PIN is accepted; rejects if the user gives up.
export const AdminUnlockContext = createContext<() => Promise<void>>(() => Promise.reject(new Error('no AdminLayout')))

type RpcResult<T> = {
  data: T | null
  error: { message?: string; details?: string | null; code?: string } | null
}

// WHY: the server owns the admin window (E-16 when it lapsed). S9 admin RPCs go through this so
// an expired window asks for the PIN in place, keeps the form state, and retries once.
export async function callWithUnlock<T>(requestUnlock: () => Promise<void>, call: () => PromiseLike<RpcResult<T>>): Promise<T | null> {
  let result = await call()
  if (result.error && parseRpcError(result.error).code === 'E-16') {
    await requestUnlock()
    result = await call()
  }
  if (result.error) throw result.error
  return result.data
}

export function useAdminRpc() {
  const requestUnlock = useContext(AdminUnlockContext)
  return useCallback(<T>(call: () => PromiseLike<RpcResult<T>>) => callWithUnlock(requestUnlock, call), [requestUnlock])
}

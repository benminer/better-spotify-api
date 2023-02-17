export const exponentialBackoffWithJitter = (args: {
  retryCount: number
  retryDelay: number
  maxRetryDelay: number
}) => {
  const backoffMs = Math.pow(2, args.retryCount) * args.retryDelay
  const clippedBackoffMs = Math.min(backoffMs, args.maxRetryDelay)
  return clippedBackoffMs
}

export const sleep = (timeMs: number) => new Promise((resolve) => setTimeout(resolve, timeMs))

export const toCamel = (str: string): string =>
  str.replace(/([-_][a-z, 0-9])/gi, (c: string) => c.toUpperCase().replace('-', '').replace('_', ''))

export const convertObjectToCamelCase = (obj: { [key: string]: any }): { [key: string]: any } =>
  Object.keys(obj).reduce((prev: any, curr: string) => ({ ...prev, [toCamel(curr)]: obj[curr] }), {})

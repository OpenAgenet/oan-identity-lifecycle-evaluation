export const experimentTimeoutMs=1_500_000;
export const t1Policy={
 registrationTimeoutMs:experimentTimeoutMs,
 queryTimeoutMs:experimentTimeoutMs,
 readTimeoutMs:experimentTimeoutMs,
 batchTimeoutMs:experimentTimeoutMs,
 readinessTimeoutMs:experimentTimeoutMs,
 observerConcurrency:8,
} as const;
export function requestBudget(url:string):number{
 const pathname=new URL(url).pathname;
 return pathname==='/resources/register'?t1Policy.registrationTimeoutMs:
  pathname==='/discovery/resources/query'?t1Policy.queryTimeoutMs:t1Policy.readTimeoutMs;
}

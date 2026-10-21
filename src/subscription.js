// Decides, from a company's "paid until" date, what the app should do.
//   exempt  : never charged (your own company, friends)
//   active  : paid up
//   warning : paid up, but it ends within a day, so show a reminder and keep everything working
//   locked  : never paid, or the date has passed: only the payment screen is shown
const DAY = 24 * 60 * 60 * 1000

export function billingState(org, now = Date.now()) {
  if (org.plan_exempt) return { status: 'exempt' }
  const until = org.paid_until ? new Date(org.paid_until).getTime() : 0
  if (!until) return { status: 'locked', reason: 'new' }
  if (until <= now) return { status: 'locked', reason: 'expired', until }
  if (until - now <= DAY) return { status: 'warning', until }
  return { status: 'active', until }
}

export const when = t => new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })

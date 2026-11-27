'use server';

/**
 * GLEW Studio — Admin Metrics API
 * Server-side actions for calculating real platform metrics from Supabase
 */

import { createServiceRoleClient } from '@/lib/supabase/service';
import type { Database } from '@/types/supabase';

export interface AdminMetrics {
  mrr: number;
  arr: number;
  activeSubscribers: number;
  newThisMonth: number;
  churnRate: number;
  courseSales: number;
  averageTicket: number;
  totalRevenue: number;
}

/**
 * Calculate real admin metrics from Supabase
 */
export async function getAdminMetrics(): Promise<AdminMetrics> {
  const supabase = createServiceRoleClient();

  try {
    // Run all queries in parallel for performance
    const [subscriptionsResult, membershipPlansResult, coursePurchasesResult, profilesResult] =
      await Promise.all([
        // Get all subscriptions with tier info
        supabase
          .from('subscriptions')
          .select('id, user_id, tier, status, started_at, created_at, updated_at')
          .neq('status', 'expired'),
        // Get membership plans for pricing
        supabase.from('membership_plans').select('slug, monthly_price, annual_monthly_price'),
        // Get completed course purchases
        supabase
          .from('course_purchases')
          .select('id, user_id, course_id, price_paid, purchased_at, purchase_status')
          .eq('purchase_status', 'paid'),
        // Get all profiles (users) for new user count
        supabase.from('profiles').select('id, created_at'),
      ]);

    // Handle errors
    if (subscriptionsResult.error) {
      throw new Error(`Error fetching subscriptions: ${subscriptionsResult.error.message}`);
    }
    if (membershipPlansResult.error) {
      throw new Error(`Error fetching membership plans: ${membershipPlansResult.error.message}`);
    }
    if (coursePurchasesResult.error) {
      throw new Error(`Error fetching course purchases: ${coursePurchasesResult.error.message}`);
    }
    if (profilesResult.error) {
      throw new Error(`Error fetching profiles: ${profilesResult.error.message}`);
    }

    const subscriptions = subscriptionsResult.data ?? [];
    const membershipPlans = membershipPlansResult.data ?? [];
    const coursePurchases = coursePurchasesResult.data ?? [];
    const profiles = profilesResult.data ?? [];

    // Build price map from membership plans
    const monthlyPriceMap = new Map<string, number>();
    membershipPlans.forEach((plan) => {
      monthlyPriceMap.set(plan.slug, plan.monthly_price);
    });

    // 1. Calculate MRR - sum of monthly prices for active subscriptions
    const activeSubscriptions = subscriptions.filter((s) => s.status === 'active');
    const mrr = activeSubscriptions.reduce((sum, sub) => {
      const price = monthlyPriceMap.get(sub.tier) || 0;
      return sum + price;
    }, 0);

    // 2. ARR = MRR * 12
    const arr = mrr * 12;

    // 3. Active subscribers count
    const activeSubscribers = activeSubscriptions.length;

    // 4. New this month - new active subscriptions created in current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonthISO = startOfMonth.toISOString();

    const newThisMonth = activeSubscriptions.filter((sub) => {
      const createdAt = new Date(sub.created_at || sub.started_at);
      return createdAt >= startOfMonth;
    }).length;

    // 5. Churn Rate - cancelled subscriptions this month / active at start of month
    const cancelledThisMonth = subscriptions.filter((sub) => {
      if (sub.status !== 'cancelled') return false;
      const updatedAt = new Date(sub.updated_at || sub.created_at);
      return updatedAt >= startOfMonth;
    }).length;

    const activeAtStartOfMonth = subscriptions.filter((sub) => {
      const createdAt = new Date(sub.created_at || sub.started_at);
      return createdAt < startOfMonth && sub.status === 'active';
    }).length;

    const churnRate =
      activeAtStartOfMonth > 0
        ? parseFloat(((cancelledThisMonth / activeAtStartOfMonth) * 100).toFixed(1))
        : 0;

    // 6. Course sales - count of completed purchases
    const courseSales = coursePurchases.length;

    // 7. Average ticket - average of completed course purchases
    const totalCourseRevenue = coursePurchases.reduce((sum, p) => sum + (p.price_paid || 0), 0);
    const averageTicket = courseSales > 0 ? Math.round(totalCourseRevenue / courseSales) : 0;

    // 8. Total Revenue - subscription revenue (MRR * 12 for annualized) + course revenue
    // For total revenue, we consider: all-time course revenue + annualized subscription revenue
    const totalRevenue = Math.round(totalCourseRevenue + arr);

    return {
      mrr: Math.round(mrr),
      arr: Math.round(arr),
      activeSubscribers,
      newThisMonth,
      churnRate,
      courseSales,
      averageTicket,
      totalRevenue,
    };
  } catch (error) {
    console.error('[getAdminMetrics] Error:', error);
    // Return zeros on error - no mock data
    return {
      mrr: 0,
      arr: 0,
      activeSubscribers: 0,
      newThisMonth: 0,
      churnRate: 0,
      courseSales: 0,
      averageTicket: 0,
      totalRevenue: 0,
    };
  }
}

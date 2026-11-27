import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service';

export interface AdminMetrics {
  mrr: number;
  arr: number;
  activeSubscribers: number;
  newThisMonth: number;
  churnRate: number;
  courseSales: number;
  averageTicket: number;
  totalRevenue: number;
  totalStudents: number;
  totalAdmins: number;
  freeAccounts: number;
  conversionRate: number;
}

export async function GET() {
  try {
    const supabase = createServiceRoleClient();

    // Run all queries in parallel for performance
    const [subscriptionsResult, membershipPlansResult, coursePurchasesResult, usersResult] =
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
        // Get all users from auth (service role required)
        supabase.auth.admin.listUsers(),
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
    if (usersResult.error) {
      throw new Error(`Error fetching users: ${usersResult.error.message}`);
    }

    const subscriptions = subscriptionsResult.data ?? [];
    const membershipPlans = membershipPlansResult.data ?? [];
    const coursePurchases = coursePurchasesResult.data ?? [];
    const users = usersResult.data?.users ?? [];

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
    const totalRevenue = Math.round(totalCourseRevenue + arr);

    // 9. Total Students - users with role !== 'admin' in app_metadata
    // 10. Total Admins - users with role === 'admin' in app_metadata (server-side only)
    const totalAdmins = users.filter((user) => user.app_metadata?.role === 'admin').length;
    const totalStudents = users.length - totalAdmins;

    // 11. Free Accounts - students without active paid subscription and without completed course purchases
    const activeSubscriberUserIds = new Set(activeSubscriptions.map((s) => s.user_id));
    const payingStudentUserIds = new Set(coursePurchases.map((p) => p.user_id));
    const payingUserIds = new Set([...activeSubscriberUserIds, ...payingStudentUserIds]);

    const freeAccounts = users.filter((user) => {
      if (user.app_metadata?.role === 'admin') return false;
      return !payingUserIds.has(user.id);
    }).length;

    // 12. Conversion Rate - percentage of students with paid subscription or completed purchases
    const conversionRate =
      totalStudents > 0
        ? parseFloat((((totalStudents - freeAccounts) / totalStudents) * 100).toFixed(1))
        : 0;

    const metrics: AdminMetrics = {
      mrr: Math.round(mrr),
      arr: Math.round(arr),
      activeSubscribers,
      newThisMonth,
      churnRate,
      courseSales,
      averageTicket,
      totalRevenue,
      totalStudents,
      totalAdmins,
      freeAccounts,
      conversionRate,
    };

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('[API/metrics] Error:', error);
    // Return zeros on error - no mock data
    const emptyMetrics: AdminMetrics = {
      mrr: 0,
      arr: 0,
      activeSubscribers: 0,
      newThisMonth: 0,
      churnRate: 0,
      courseSales: 0,
      averageTicket: 0,
      totalRevenue: 0,
      totalStudents: 0,
      totalAdmins: 0,
      freeAccounts: 0,
      conversionRate: 0,
    };
    return NextResponse.json(emptyMetrics);
  }
}

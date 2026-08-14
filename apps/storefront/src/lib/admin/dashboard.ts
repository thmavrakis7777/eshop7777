import "server-only";
import { sql } from "@/lib/db/client";

/**
 * Dashboard metrics.
 *
 * ONE round trip for every headline figure. The brief's warning — "do not
 * create expensive analytics queries on every page load" — is taken
 * literally: this is a single statement of scalar subqueries, each backed by
 * an index (orders(created_at), orders(status),
 * product_variant(stock_quantity) partial WHERE <= 5).
 *
 * Deliberately NOT cached with unstable_cache. An operator refreshing the
 * dashboard after taking an order needs to see it; a stale "today's sales"
 * figure is worse than a 20ms query. Revisit only if the orders table grows
 * to where these subqueries stop being trivial.
 */

export type DashboardMetrics = {
  salesTodayCents: number;
  ordersToday: number;
  ordersThisWeek: number;
  revenueThisWeekCents: number;
  revenueThisMonthCents: number;
  averageOrderValueCents: number;
  unitsSoldThisMonth: number;
  pendingOrders: number;
  lowStockCount: number;
  outOfStockCount: number;
  newCustomersThisWeek: number;
  totalProducts: number;
  activeProducts: number;
};

// Cancelled orders are excluded from every money figure — counting revenue
// the store will never receive is the kind of flattering-but-wrong number a
// dashboard exists to avoid.
const LIVE = sql`status <> 'cancelled'`;

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const [m] = await sql<
    {
      sales_today: string;
      orders_today: string;
      orders_this_week: string;
      revenue_this_week: string;
      revenue_this_month: string;
      aov: string;
      units_this_month: string;
      pending_orders: string;
      low_stock: string;
      out_of_stock: string;
      new_customers_week: string;
      total_products: string;
      active_products: string;
    }[]
  >`
    SELECT
      (SELECT COALESCE(SUM(total_cents), 0) FROM shop.orders
        WHERE ${LIVE} AND created_at >= date_trunc('day', now()))          AS sales_today,
      (SELECT COUNT(*) FROM shop.orders
        WHERE ${LIVE} AND created_at >= date_trunc('day', now()))          AS orders_today,
      (SELECT COUNT(*) FROM shop.orders
        WHERE ${LIVE} AND created_at >= now() - interval '7 days')         AS orders_this_week,
      (SELECT COALESCE(SUM(total_cents), 0) FROM shop.orders
        WHERE ${LIVE} AND created_at >= now() - interval '7 days')         AS revenue_this_week,
      (SELECT COALESCE(SUM(total_cents), 0) FROM shop.orders
        WHERE ${LIVE} AND created_at >= date_trunc('month', now()))        AS revenue_this_month,
      (SELECT COALESCE(AVG(total_cents), 0)::bigint FROM shop.orders
        WHERE ${LIVE} AND created_at >= now() - interval '30 days')        AS aov,
      (SELECT COALESCE(SUM(i.quantity), 0) FROM shop.order_item i
         JOIN shop.orders o ON o.id = i.order_id
        WHERE o.status <> 'cancelled' AND o.created_at >= date_trunc('month', now())) AS units_this_month,
      (SELECT COUNT(*) FROM shop.orders WHERE status = 'pending')          AS pending_orders,
      (SELECT COUNT(*) FROM shop.product_variant
        WHERE is_active AND NOT allow_backorder
          AND stock_quantity > 0 AND stock_quantity <= 5)                  AS low_stock,
      (SELECT COUNT(*) FROM shop.product_variant
        WHERE is_active AND NOT allow_backorder AND stock_quantity <= 0)   AS out_of_stock,
      (SELECT COUNT(*) FROM shop.customer
        WHERE created_at >= now() - interval '7 days')                     AS new_customers_week,
      (SELECT COUNT(*) FROM shop.product)                                  AS total_products,
      (SELECT COUNT(*) FROM shop.product WHERE is_active)                  AS active_products`;

  const n = (v: string) => Number(v ?? 0);
  return {
    salesTodayCents: n(m.sales_today),
    ordersToday: n(m.orders_today),
    ordersThisWeek: n(m.orders_this_week),
    revenueThisWeekCents: n(m.revenue_this_week),
    revenueThisMonthCents: n(m.revenue_this_month),
    averageOrderValueCents: n(m.aov),
    unitsSoldThisMonth: n(m.units_this_month),
    pendingOrders: n(m.pending_orders),
    lowStockCount: n(m.low_stock),
    outOfStockCount: n(m.out_of_stock),
    newCustomersThisWeek: n(m.new_customers_week),
    totalProducts: n(m.total_products),
    activeProducts: n(m.active_products),
  };
}

export type RecentOrder = {
  id: string;
  orderNumber: number;
  email: string;
  totalCents: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
};

export async function getRecentOrders(limit = 8): Promise<RecentOrder[]> {
  const rows = await sql<
    {
      id: string;
      order_number: number;
      email: string;
      total_cents: number;
      status: string;
      payment_status: string;
      created_at: Date;
    }[]
  >`SELECT id, order_number, email, total_cents, status, payment_status, created_at
      FROM shop.orders ORDER BY created_at DESC LIMIT ${limit}`;

  return rows.map((r) => ({
    id: r.id,
    orderNumber: r.order_number,
    email: r.email,
    totalCents: r.total_cents,
    status: r.status,
    paymentStatus: r.payment_status,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export type BestSeller = { slug: string; title: string; unitsSold: number; revenueCents: number };

/**
 * Real best-sellers, computed from actual order lines. Until orders exist
 * this correctly returns nothing — the storefront's "Recommended" rail stays
 * an honest curated slice rather than a fabricated popularity ranking, and
 * this is the query that will eventually make it real.
 */
export async function getBestSellers(limit = 5): Promise<BestSeller[]> {
  const rows = await sql<
    { slug: string; title: string; units: string; revenue: string }[]
  >`SELECT COALESCE(i.product_slug, '') AS slug, i.title,
           SUM(i.quantity)::text AS units, SUM(i.line_total_cents)::text AS revenue
      FROM shop.order_item i
      JOIN shop.orders o ON o.id = i.order_id
     WHERE o.status <> 'cancelled' AND o.created_at >= now() - interval '90 days'
     GROUP BY i.product_slug, i.title
     ORDER BY SUM(i.quantity) DESC
     LIMIT ${limit}`;

  return rows.map((r) => ({
    slug: r.slug,
    title: r.title,
    unitsSold: Number(r.units),
    revenueCents: Number(r.revenue),
  }));
}

export type LowStockItem = { sku: string; title: string; slug: string; stock: number };

export async function getLowStockItems(limit = 8): Promise<LowStockItem[]> {
  const rows = await sql<
    { sku: string; title: string; slug: string; stock_quantity: number }[]
  >`SELECT v.sku, p.title, p.slug, v.stock_quantity
      FROM shop.product_variant v
      JOIN shop.product p ON p.id = v.product_id
     WHERE v.is_active AND p.is_active AND NOT v.allow_backorder AND v.stock_quantity <= 5
     ORDER BY v.stock_quantity, p.title COLLATE "el-GR-x-icu"
     LIMIT ${limit}`;

  return rows.map((r) => ({ sku: r.sku, title: r.title, slug: r.slug, stock: r.stock_quantity }));
}

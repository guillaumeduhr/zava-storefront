import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cartItemSchema, totalize } from "@/lib/cart";

const BodySchema = z.object({
  items: z.array(cartItemSchema).min(1),
  region: z.string().min(1).max(10),
  promoCode: z.string().min(1).max(50),
});

/**
 * Apply a promo code to a cart and return the updated totals.
 *
 * POST /api/cart/promo
 * Body: { items: CartItem[], region: string, promoCode: string }
 * Returns: CartTotals
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { items, region, promoCode } = parsed.data;
  const totals = totalize(items, promoCode, region);
  return NextResponse.json(totals);
}

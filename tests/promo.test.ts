import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../app/api/cart/promo/route';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/cart/promo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const oneItem = [{ productId: 'p1', quantity: 2, unitPriceCents: 1000 }];

describe('POST /api/cart/promo', () => {
  it('returns totals with WELCOME10 discount applied', async () => {
    const res = await POST(makeRequest({ items: oneItem, region: 'GB', promoCode: 'WELCOME10' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    // subtotal = 2000, discount = 200 (10%), taxable = 1800, tax (GB 20%) = 360
    expect(data.subtotalCents).toBe(2000);
    expect(data.discountCents).toBe(200);
    expect(data.taxCents).toBe(360);
    expect(data.totalCents).toBe(2160);
  });

  it('returns totals with VIP25 discount when subtotal >= 10000', async () => {
    const items = [{ productId: 'p1', quantity: 10, unitPriceCents: 1500 }];
    const res = await POST(makeRequest({ items, region: 'DE', promoCode: 'VIP25' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    // subtotal = 15000, discount = 3750 (25%), taxable = 11250, tax (DE 19%) = 2138
    expect(data.subtotalCents).toBe(15000);
    expect(data.discountCents).toBe(3750);
    expect(data.taxCents).toBe(2138);
  });

  it('returns zero discount for unknown promo code', async () => {
    const res = await POST(makeRequest({ items: oneItem, region: 'US-OR', promoCode: 'INVALID99' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.discountCents).toBe(0);
  });

  it('returns 400 when items is empty', async () => {
    const res = await POST(makeRequest({ items: [], region: 'GB', promoCode: 'WELCOME10' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('invalid_request');
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await POST(makeRequest({ items: oneItem }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_request');
  });

  it('returns 400 when body is malformed JSON', async () => {
    const req = new NextRequest('http://localhost/api/cart/promo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json{{{',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when promoCode is empty string', async () => {
    const res = await POST(makeRequest({ items: oneItem, region: 'GB', promoCode: '' }));
    expect(res.status).toBe(400);
  });
});

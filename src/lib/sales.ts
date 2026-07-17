// Cart -> sale-line math for a product quick-sale checkout, shared by the
// sales route and tested in isolation (same convention as tariffs.ts /
// reservations.ts). A checkout request is either fully valid or fully
// rejected — buildSaleLines throws rather than silently dropping a bad line.

export type CartItem = { productId: string; quantity: number };
export type ProductPrice = { id: string; price: number };
export type SaleLineResult = { productId: string; quantity: number; unitPrice: number; cost: number };

export function buildSaleLines(items: CartItem[], products: ProductPrice[]): SaleLineResult[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  return items.map((item) => {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error("invalid-quantity");
    }
    const product = byId.get(item.productId);
    if (!product) {
      throw new Error("unknown-product");
    }
    return {
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: product.price,
      cost: product.price * item.quantity,
    };
  });
}

export function saleTotal(lines: { cost: number }[]): number {
  return lines.reduce((sum, l) => sum + l.cost, 0);
}

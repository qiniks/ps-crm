import { describe, expect, it } from "vitest";
import { buildSaleLines, saleTotal } from "./sales";

const PRODUCTS = [
  { id: "p1", price: 100 },
  { id: "p2", price: 250 },
];

describe("buildSaleLines", () => {
  it("builds a line per cart item with unit price and cost from the product list", () => {
    const lines = buildSaleLines(
      [
        { productId: "p1", quantity: 2 },
        { productId: "p2", quantity: 1 },
      ],
      PRODUCTS
    );
    expect(lines).toEqual([
      { productId: "p1", quantity: 2, unitPrice: 100, cost: 200 },
      { productId: "p2", quantity: 1, unitPrice: 250, cost: 250 },
    ]);
  });

  it("uses the current product price argument, not any client-supplied price", () => {
    // Cart items never carry a price field at all — this test documents that
    // buildSaleLines only ever reads price from the `products` argument.
    const lines = buildSaleLines([{ productId: "p1", quantity: 1 }], PRODUCTS);
    expect(lines[0].unitPrice).toBe(100);
  });

  it("throws on a quantity of zero", () => {
    expect(() => buildSaleLines([{ productId: "p1", quantity: 0 }], PRODUCTS)).toThrow(
      "invalid-quantity"
    );
  });

  it("throws on a negative quantity", () => {
    expect(() => buildSaleLines([{ productId: "p1", quantity: -1 }], PRODUCTS)).toThrow(
      "invalid-quantity"
    );
  });

  it("throws on a non-integer quantity", () => {
    expect(() => buildSaleLines([{ productId: "p1", quantity: 1.5 }], PRODUCTS)).toThrow(
      "invalid-quantity"
    );
  });

  it("throws when a cart item references a product not in the given list", () => {
    expect(() => buildSaleLines([{ productId: "missing", quantity: 1 }], PRODUCTS)).toThrow(
      "unknown-product"
    );
  });

  it("returns an empty array for an empty cart", () => {
    expect(buildSaleLines([], PRODUCTS)).toEqual([]);
  });
});

describe("saleTotal", () => {
  it("sums line costs", () => {
    expect(saleTotal([{ cost: 200 }, { cost: 250 }])).toBe(450);
  });

  it("is 0 for no lines", () => {
    expect(saleTotal([])).toBe(0);
  });
});

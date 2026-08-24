import { prisma } from '@/lib/prisma';
import { mapProduct } from '@/lib/catalog';
import { deriveLegacyStock, syncColorSizeStock } from '@/lib/inventory';
import { productCreateSchema } from '@/lib/validation';
import { requirePermission, audit, genId } from '@/lib/admin-guard';
import { ok, fail, handleError } from '@/lib/http';
import { PRODUCT_SIZES } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/products — every product, unfiltered (incl. draft/soldout/POS-only),
 * unlike the public catalog (/api/store). Backs the admin Products tab and the
 * Receive/Adjust/Transfer/POS/manual-order product pickers.
 */
export async function GET() {
  try {
    await requirePermission('products', 'read');
    const rawProducts = await prisma.product.findMany({
      include: { inventory: { include: { location: true } } },
      orderBy: { name: 'asc' },
    });
    const products = rawProducts.map(mapProduct);
    return ok({ products });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/admin/products — create a product. */
export async function POST(request: Request) {
  try {
    const session = await requirePermission('products', 'edit');
    const data = productCreateSchema.parse(await request.json());
    const id = genId('p');
    const costPrice = session.role === 'admin' ? data.costPrice : 0;

    const hasColorSizeStock = Object.keys(data.colorSizeStock).length > 0;
    const legacy = hasColorSizeStock ? deriveLegacyStock(data.colorSizeStock) : null;

    const location = await prisma.location.findUnique({ where: { id: data.locationId } });
    if (!location) return fail('Selected location does not exist.', 400);

    // The admin's "Stock per colour & size" grid renders a column for every
    // globally configured size, for every colour on the product — but the
    // draft payload only contains combos the admin actually typed a value
    // into. For a product that genuinely uses sized variants, fill the rest
    // in at 0 so every size the grid visibly offered gets a real Inventory
    // row (out-of-stock, not absent) rather than silently disappearing from
    // the customer page. Sizeless products (only the blank "No size" column
    // used) are left untouched — they were never offered in named sizes.
    const usesNamedSizes = Object.values(data.colorSizeStock).some(bySize => Object.keys(bySize).some(size => size !== ''));
    let colorSizeStockToSync = data.colorSizeStock;
    if (usesNamedSizes) {
      const rowColors = data.colors.length > 0 ? data.colors : [''];
      const filled: Record<string, Record<string, number>> = {};
      for (const color of rowColors) {
        filled[color] = { ...data.colorSizeStock[color] };
        for (const size of PRODUCT_SIZES) {
          if (filled[color][size] === undefined) filled[color][size] = 0;
        }
      }
      colorSizeStockToSync = filled;
    }

    const created = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          id,
          name: data.name,
          collection: data.collection,
          category: data.category,
          sub: data.sub,
          price: data.price,
          was: data.was ?? null,
          discountType: data.discountType ?? null,
          discountValue: data.discountValue ?? 0,
          costPrice,
          stock: legacy?.stock ?? data.stock,
          status: data.status,
          badge: data.badge ?? null,
          colors: data.colors,
          sizes: legacy?.sizes ?? data.sizes,
          sizeStock: legacy?.sizeStock ?? data.sizeStock,
          descriptionSections: data.descriptionSections,
          showInWebStore: data.showInWebStore,
          img: data.img,
        },
      });

      if (hasColorSizeStock) {
        await syncColorSizeStock(tx, id, location.id, colorSizeStockToSync);
      }

      return tx.product.findUniqueOrThrow({
        where: { id: product.id },
        include: { inventory: { include: { location: true } } },
      });
    });

    await audit(session.email, 'product.create', id, { name: data.name });
    const product = session.role === 'admin' ? { ...mapProduct(created), costPrice: created.costPrice } : mapProduct(created);
    return ok({ product }, 201);
  } catch (err) {
    return handleError(err);
  }
}

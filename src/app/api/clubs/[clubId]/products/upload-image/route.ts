import { NextRequest, NextResponse } from "next/server";
import { requireMembership } from "@/lib/auth/requireMembership";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { imageExtension, isAllowedImageSize, isAllowedImageType } from "@/lib/productImage";

export const dynamic = "force-dynamic";

const BUCKET = "product-images";

// POST /api/clubs/[clubId]/products/upload-image — upload a product photo.
// multipart/form-data with a single "file" field. Returns { url } (a public
// Storage URL) for the caller to include as Product.imageUrl on create/edit.
// Uses the service-role Storage client (src/lib/supabase/admin.ts) so no
// Storage RLS policy is needed — same trust model as createUser.ts.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const auth = await requireMembership(clubId);
  if (!auth.ok) return auth.response;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (!isAllowedImageType(file.type)) {
    return NextResponse.json({ error: "unsupported-image-type" }, { status: 400 });
  }
  if (!isAllowedImageSize(file.size)) {
    return NextResponse.json({ error: "image-too-large" }, { status: 400 });
  }

  const ext = imageExtension(file.type);
  const path = `${clubId}/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type,
  });
  if (error) {
    return NextResponse.json({ error: "upload-failed" }, { status: 500 });
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl }, { status: 201 });
}

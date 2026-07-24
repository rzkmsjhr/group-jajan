import { jsonError, readUpload } from "@/lib/data";

export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  if (!name.startsWith("menu-")) return jsonError("Image not found.", 404);
  const contents = await readUpload(name);
  if (!contents) return jsonError("Image not found.", 404);
  const extension = name.split(".").pop()?.toLowerCase();
  const contentType = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
  return new Response(contents, {
    headers: { "content-type": contentType, "cache-control": "public, max-age=86400" },
  });
}

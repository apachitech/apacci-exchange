import { NextResponse } from "next/server";
import { getDynamicCorridors } from "@/lib/corridors";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const corridors = await getDynamicCorridors();
    return NextResponse.json({
      success: true,
      data: corridors,
    });
  } catch (err) {
    logger.error("Failed to fetch corridors", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "corridors_fetch_failed",
          message: "Impossible de charger les corridors actuellement.",
        },
      },
      { status: 500 }
    );
  }
}


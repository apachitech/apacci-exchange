import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createRecipientSchema } from "@/lib/validation";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getServerSessionCookie } from "@/lib/auth-session";
import { getAdminSandboxStore } from "@/lib/admin-store";

export async function GET() {
  if (!isSupabaseConfigured()) {
    const sessionCookie = await getServerSessionCookie();
    if (!sessionCookie) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "unauthorized",
            message:
              "Authentification requise. Veuillez vous connecter pour accéder à vos bénéficiaires.",
          },
        },
        { status: 401 }
      );
    }

    const sandbox = getAdminSandboxStore();
    const list =
      sessionCookie.role === "admin"
        ? sandbox.recipients.filter((r) => r.is_active)
        : sandbox.recipients.filter(
            (r) => r.is_active && r.user_id === sessionCookie.userId
          );
    return NextResponse.json({ success: true, data: list });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: "unauthorized", message: "Non authentifié." } },
      { status: 401 }
    );
  }

  const { data, error } = await supabase
    .from("recipients")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { success: false, error: { code: "db_error", message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: data || [] });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "invalid_json", message: "JSON invalide." } },
      { status: 400 }
    );
  }

  const parsed = createRecipientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "validation_error",
          message: parsed.error.issues[0]?.message || "Champs invalides.",
        },
      },
      { status: 400 }
    );
  }

  const { fullName, countryCode, currency, networkCode, networkName, msisdn } =
    parsed.data;

  if (!isSupabaseConfigured()) {
    const sessionCookie = await getServerSessionCookie();
    if (!sessionCookie) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "unauthorized",
            message:
              "Authentification requise. Veuillez vous connecter pour ajouter un bénéficiaire.",
          },
        },
        { status: 401 }
      );
    }

    const sandbox = getAdminSandboxStore();
    const newRec = {
      id: `rec-${Date.now()}`,
      user_id: sessionCookie.userId,
      full_name: fullName,
      country_code: countryCode,
      currency,
      network_code: networkCode,
      network_name: networkName,
      msisdn,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    sandbox.recipients.unshift(newRec);
    return NextResponse.json({ success: true, data: newRec }, { status: 201 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: "unauthorized", message: "Veuillez vous connecter." } },
      { status: 401 }
    );
  }

  const { data, error } = await supabase
    .from("recipients")
    .insert({
      user_id: user.id,
      full_name: fullName,
      country_code: countryCode,
      currency,
      network_code: networkCode,
      network_name: networkName,
      msisdn,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, error: { code: "db_error", message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { success: false, error: { code: "missing_id", message: "ID requis." } },
      { status: 400 }
    );
  }

  if (!isSupabaseConfigured()) {
    const sessionCookie = await getServerSessionCookie();
    if (!sessionCookie) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "unauthorized", message: "Veuillez vous connecter." },
        },
        { status: 401 }
      );
    }

    const sandbox = getAdminSandboxStore();
    const rec = sandbox.recipients.find((r) => r.id === id);
    if (rec && (rec.user_id === sessionCookie.userId || sessionCookie.role === "admin")) {
      rec.is_active = false;
    }
    return NextResponse.json({ success: true });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: "unauthorized", message: "Non authentifié." } },
      { status: 401 }
    );
  }

  const { error } = await supabase
    .from("recipients")
    .update({ is_active: false })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json(
      { success: false, error: { code: "db_error", message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

import "server-only";

import type { AuthProfile } from "@/lib/auth/types";
import { safeWriteAuditLog } from "@/lib/audit/safe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  SupportCenterDashboard,
  SupportConversation,
  SupportMessage,
  SupportPersonOption
} from "@/lib/support/types";

const CONVERSATION_SELECT =
  "id, participant_id, participant_role, assigned_admin_id, subject, status, created_at, updated_at";
const MESSAGE_SELECT = "id, conversation_id, sender_id, kind, body, created_at";

type ConversationRow = {
  id: string;
  participant_id: string;
  participant_role: "paciente" | "profesional";
  assigned_admin_id: string | null;
  subject: string;
  status: "abierto" | "resuelto" | "cerrado";
  created_at: string;
  updated_at: string;
};

async function hydrateConversations(rows: ConversationRow[]): Promise<SupportConversation[]> {
  if (rows.length === 0) return [];

  const supabaseAdmin = createSupabaseAdminClient();
  const conversationIds = rows.map((row) => row.id);
  const participantIds = [...new Set(rows.map((row) => row.participant_id))];
  const { data: messages, error: messageError } = await supabaseAdmin
    .from("support_messages")
    .select(MESSAGE_SELECT)
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: true });

  if (messageError) {
    throw new Error("Unable to hydrate support conversations.");
  }

  const senderIds = [...new Set((messages ?? []).map((message) => message.sender_id as string))];
  const { data: profiles, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, role")
    .in("id", [...new Set([...participantIds, ...senderIds])]);

  if (profileError) throw new Error("Unable to load support message senders.");
  const allProfiles = profiles ?? [];

  const profileMap = new Map(allProfiles.map((profile) => [profile.id, profile]));
  const messageMap = new Map<string, SupportMessage[]>();

  for (const message of messages ?? []) {
    const sender = profileMap.get(message.sender_id);
    const hydrated: SupportMessage = {
      id: message.id,
      conversation_id: message.conversation_id,
      sender_id: message.sender_id,
      sender_name: sender?.full_name ?? "Usuario",
      sender_role: sender?.role ?? "administrador",
      kind: message.kind,
      body: message.body,
      created_at: message.created_at
    };
    const existing = messageMap.get(message.conversation_id) ?? [];
    existing.push(hydrated);
    messageMap.set(message.conversation_id, existing);
  }

  return rows.map((row) => {
    const participant = profileMap.get(row.participant_id);
    return {
      ...row,
      participant_name: participant?.full_name ?? "Usuario no disponible",
      participant_email: participant?.email ?? "",
      messages: messageMap.get(row.id) ?? []
    };
  });
}

export async function getParticipantSupportConversation(profile: AuthProfile) {
  if (!['paciente', 'profesional'].includes(profile.role)) return null;

  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("support_conversations")
    .select(CONVERSATION_SELECT)
    .eq("participant_id", profile.id)
    .neq("status", "cerrado")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error("Unable to load support conversation.");
  const conversations = await hydrateConversations(data ? [data as ConversationRow] : []);
  return conversations[0] ?? null;
}

export async function getAdminSupportCenter(profile: AuthProfile): Promise<SupportCenterDashboard> {
  const supabaseAdmin = createSupabaseAdminClient();
  const [{ data: conversationRows, error: conversationError }, { data: profileRows, error: profileError }, { data: appointmentRows, error: appointmentError }] =
    await Promise.all([
      supabaseAdmin
        .from("support_conversations")
        .select(CONVERSATION_SELECT)
        .order("updated_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, email, role")
        .in("role", ["paciente", "profesional"])
        .eq("account_status", "activo")
        .order("full_name", { ascending: true }),
      supabaseAdmin
        .from("citas")
        .select("id, patient_id, professional_id, scheduled_at, status")
        .order("scheduled_at", { ascending: false })
        .limit(100)
    ]);

  if (conversationError || profileError || appointmentError) {
    await safeWriteAuditLog({
      userId: profile.id,
      role: profile.role,
      action: "support_center_read",
      entityType: "support_center",
      result: "error",
      context: "audit_support_center_read_error"
    });
    throw new Error("Unable to load support center.");
  }

  const people = (profileRows ?? []).map((person) => ({
    id: person.id,
    label: person.full_name,
    email: person.email,
    role: person.role
  })) as SupportPersonOption[];
  const peopleMap = new Map(people.map((person) => [person.id, person]));
  const conversations = await hydrateConversations((conversationRows ?? []) as ConversationRow[]);

  await safeWriteAuditLog({
    userId: profile.id,
    role: profile.role,
    action: "support_center_read",
    entityType: "support_center",
    result: "success",
    metadata: { conversation_count: conversations.length },
    context: "audit_support_center_read_success"
  });

  return {
    conversations,
    patients: people.filter((person) => person.role === "paciente"),
    professionals: people.filter((person) => person.role === "profesional"),
    appointments: (appointmentRows ?? []).map((appointment) => ({
      id: appointment.id,
      patient_name: peopleMap.get(appointment.patient_id)?.label ?? "Paciente",
      professional_name: peopleMap.get(appointment.professional_id)?.label ?? "Profesional",
      scheduled_at: appointment.scheduled_at,
      status: appointment.status
    }))
  };
}

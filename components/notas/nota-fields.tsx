import {
  DEFAULT_NOTA_TEMPLATE_SECTIONS,
  type NotaClinica,
  type NotaTemplateField,
  type NotaTemplateSection
} from "@/lib/notas/types";

type NotaFieldsProps = {
  note?: NotaClinica;
  sections?: NotaTemplateSection[];
  values?: Record<string, Record<string, string | number | boolean | null>> | null;
  initialValues?: Record<string, string | number | boolean | null>;
  disabled?: boolean;
};

const scores = [
  ["mood_score", "Animo 1-10"],
  ["anxiety_score", "Ansiedad 1-10"],
  ["hope_score", "Esperanza 1-10"]
] as const;

const moodScaleOptions = [
  { value: "-5", label: "-5 Muy bajo" },
  { value: "-3", label: "-3 Bajo" },
  { value: "0", label: "0 Neutro" },
  { value: "3", label: "+3 Estable" },
  { value: "5", label: "+5 Muy positivo" }
];

function toLocalDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function legacyValue(note: NotaClinica | undefined, fieldId: string) {
  if (!note) {
    return "";
  }

  const legacyValues: Record<string, string | number | null | undefined> = {
    session_date: note.session_date,
    session_time: note.session_time?.slice(0, 5),
    tcc_session_number: note.tcc_session_number,
    objective_scores: note.objective_scores,
    patient_plan: note.patient_plan,
    therapist_objectives: note.therapist_objectives,
    mood_review: note.mood_review,
    previous_session_bridge: note.previous_session_bridge,
    session_agenda: note.session_agenda,
    action_plan_review: note.action_plan_review,
    key_session_points: note.key_session_points,
    session_summary_feedback: note.session_summary_feedback,
    home_action_plan: note.home_action_plan,
    patient_feedback: note.patient_feedback,
    observations: note.observations,
    next_session_at: note.next_session_at?.slice(0, 10),
    risk_flags: note.risk_flags
  };

  return legacyValues[fieldId] ?? "";
}

function fieldValue(
  note: NotaClinica | undefined,
  values: NotaFieldsProps["values"],
  initialValues: NotaFieldsProps["initialValues"],
  sectionId: string,
  fieldId: string
) {
  const value = values?.[sectionId]?.[fieldId];
  const legacy = legacyValue(note, fieldId);

  if (value !== undefined && value !== null && value !== "") {
    return value;
  }

  if (legacy !== undefined && legacy !== null && legacy !== "") {
    return legacy;
  }

  return initialValues?.[fieldId] ?? "";
}

function FieldInput({
  field,
  name,
  value,
  disabled
}: {
  field: NotaTemplateField;
  name: string;
  value: string | number | boolean | null | undefined;
  disabled: boolean;
}) {
  const baseClass =
    "mt-2 w-full rounded-md border border-ink/15 px-3 py-2 outline-none focus:border-azulMedio focus:ring-2 focus:ring-azulMedio/20";
  const currentValue =
    value ??
    (field.type === "date"
      ? toLocalDateInputValue(new Date())
      : field.type === "time"
        ? new Date().toTimeString().slice(0, 5)
        : "");

  if (field.id === "mood_review") {
    return (
      <div className="mt-2 grid gap-3 lg:grid-cols-[minmax(10rem,0.6fr)_1fr] lg:items-start">
        <select
          name={name}
          disabled={disabled}
          required={field.required}
          defaultValue={String(currentValue)}
          className={baseClass.replace("mt-2 ", "")}
        >
          <option value="">Seleccionar</option>
          {moodScaleOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="rounded-md border border-ink/10 bg-grisMuyClaro p-3">
          <div className="grid grid-cols-5 gap-1 text-center text-[11px] text-ink/60">
            {moodScaleOptions.map((option) => (
              <span key={option.value}>
                <strong className="block text-ink">{option.value === "3" || option.value === "5" ? `+${option.value}` : option.value}</strong>
                {option.label.replace(/^[-+0-9]+\s*/, "")}
              </span>
            ))}
          </div>
          <div className="mt-3 h-2 rounded-full bg-gradient-to-r from-rojoRompe via-gold to-azulMedio" />
        </div>
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <textarea
        name={name}
        rows={4}
        disabled={disabled}
        required={field.required}
        defaultValue={
          typeof currentValue === "string" || typeof currentValue === "number"
            ? String(currentValue)
            : ""
        }
        className={baseClass}
      />
    );
  }

  if (field.type === "select") {
    return (
      <select
        name={name}
        disabled={disabled}
        required={field.required}
        defaultValue={String(currentValue)}
        className={baseClass}
      >
        <option value="">Seleccionar</option>
        {(field.options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "checkbox") {
    return (
      <input
        type="checkbox"
        name={name}
        disabled={disabled}
        defaultChecked={value === true || value === "true"}
        className="mt-3 h-4 w-4 rounded border-ink/20 text-azulMedio focus:ring-azulMedio"
      />
    );
  }

  return (
    <input
      type={field.type}
      name={name}
      disabled={disabled}
      required={field.required}
      defaultValue={String(currentValue)}
      className={baseClass}
    />
  );
}

export function NotaFields({
  note,
  sections,
  values,
  initialValues,
  disabled = false
}: NotaFieldsProps) {
  const templateSections =
    sections ?? note?.note_template_snapshot?.sections ?? DEFAULT_NOTA_TEMPLATE_SECTIONS;
  const templateValues = values ?? note?.note_template_values ?? {};

  return (
    <>
      {templateSections.map((section) => (
        <section key={section.id} className="space-y-4 rounded-md border border-ink/10 bg-ink/[0.02] p-4">
          <div>
            <h3 className="text-sm font-semibold text-ink">{section.title}</h3>
            {section.description ? (
              <p className="mt-1 text-xs text-ink/60">{section.description}</p>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {section.fields.map((field) => (
              <label
                key={field.id}
                className={
                  field.type === "textarea" || field.id === "mood_review"
                    ? "block md:col-span-2"
                    : "block"
                }
              >
                <span className="text-sm font-medium text-ink">{field.label}</span>
                <FieldInput
                  field={field}
                  name={`field_${section.id}_${field.id}`}
                  value={fieldValue(note, templateValues, initialValues, section.id, field.id)}
                  disabled={disabled}
                />
              </label>
            ))}
          </div>
        </section>
      ))}

      <div className="grid gap-4 md:grid-cols-3">
        {scores.map(([name, label]) => (
          <label key={name} className="block">
            <span className="text-sm font-medium text-ink">{label}</span>
            <input
              type="number"
              min={1}
              max={10}
              name={name}
              disabled={disabled}
              defaultValue={note?.[name] ?? ""}
              className="mt-2 w-full rounded-md border border-ink/15 px-3 py-2 outline-none focus:border-azulMedio focus:ring-2 focus:ring-azulMedio/20"
            />
          </label>
        ))}
      </div>
    </>
  );
}

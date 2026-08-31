export const PROCESO_GENERAL_STATUSES = ["activo", "cerrado"] as const;
export type ProcesoGeneralStatus = (typeof PROCESO_GENERAL_STATUSES)[number];

export const PROCESS_MODEL_TYPES = [
  "tcc",
  "gestalt",
  "third_wave",
  "psychodynamic",
  "humanistic",
  "systemic",
  "brief_systemic",
  "neuropsychological",
  "gestalt_humanistic",
  "rebt",
  "emdr",
  "psychological_consulting",
  "schema_therapy",
  "dbt",
  "act",
  "sfbt",
  "mbct",
  "logotherapy",
  "narrative",
  "gottman",
  "general"
] as const;
export type ProcessModelType = (typeof PROCESS_MODEL_TYPES)[number];

export const PROCESS_MODEL_LABEL: Record<ProcessModelType, string> = {
  tcc: "Cognitivo conductual",
  gestalt: "Gestalt",
  third_wave: "Terapias de tercera generacion",
  psychodynamic: "Terapia psicodinamica",
  humanistic: "Terapia humanista",
  systemic: "Terapia sistemica",
  brief_systemic: "Terapia sistemica breve",
  neuropsychological: "Terapia neuropsicologica",
  gestalt_humanistic: "Terapia gestalt-humanista",
  rebt: "Terapia racional emotiva",
  emdr: "EMDR",
  psychological_consulting: "Consultoria psicologica",
  schema_therapy: "Terapia de esquemas de Young",
  dbt: "Terapia dialectica conductual",
  act: "Terapia de aceptacion y compromiso",
  sfbt: "Terapia breve centrada en soluciones",
  mbct: "Terapia cognitiva basada en mindfulness",
  logotherapy: "Logoterapia",
  narrative: "Terapia narrativa",
  gottman: "Metodo Gottman",
  general: "Otros (modelo general)"
};

export const PROCESS_FIELD_TYPES = ["text", "textarea", "select", "date", "number", "checkbox"] as const;
export type ProcessFieldType = (typeof PROCESS_FIELD_TYPES)[number];

export type ProcessTemplateField = {
  id: string;
  label: string;
  type: ProcessFieldType;
  options?: string[];
};

export type ProcessTemplateStep = {
  id: string;
  title: string;
  description?: string;
  fields: ProcessTemplateField[];
};

export type ProcessTemplate = {
  id: string;
  professional_id: string;
  model_type: ProcessModelType;
  version: number;
  steps: ProcessTemplateStep[];
  created_by_user_id: string | null;
  created_at: string;
};

export type ProcesoTerapeutico = {
  id: string;
  expediente_id: string;
  patient_id: string;
  professional_id: string;
  model_type: ProcessModelType;
  template_id: string | null;
  template_version: number;
  template_snapshot: {
    steps: ProcessTemplateStep[];
  };
  status: ProcesoGeneralStatus;
  started_at: string;
  closed_at: string | null;
  closed_by_note_id: string | null;
  step_data: Record<string, Record<string, string | number | boolean | null>>;
  gpt_instructions: Record<string, string>;
  linked_note_ids: string[];
  linked_assessment_ids: string[];
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  reconceptualization_interval: 4 | 8 | 10 | 12 | null;
  last_reconceptualized_session_count: number;
  ai_conceptualization_enabled: boolean;
  ai_next_block_plan_enabled: boolean;
};

export type ProcesoListItem = Pick<
  ProcesoTerapeutico,
  | "id"
  | "expediente_id"
  | "patient_id"
  | "model_type"
  | "status"
  | "started_at"
  | "closed_at"
  | "updated_at"
> & {
  patient: {
    full_name: string;
    email: string;
  };
};

export type ProcesoDetail = ProcesoTerapeutico & {
  patient: {
    full_name: string;
    email: string;
  };
};

function field(id: string, label: string, type: ProcessFieldType = "textarea", options?: string[]) {
  return options ? { id, label, type, options } : { id, label, type };
}

const commonClosureStep: ProcessTemplateStep = {
  id: "cierre",
  title: "Cierre y continuidad",
  description: "Cierre clinico, prevencion de recaidas y recomendaciones.",
  fields: [
    field("criterios_cierre", "Criterios de cierre o alta"),
    field("logros", "Cambios o logros observados"),
    field("pendientes", "Pendientes clinicos"),
    field("plan_mantenimiento", "Plan de mantenimiento o seguimiento")
  ]
};

export const DEFAULT_GENERAL_TEMPLATE_STEPS: ProcessTemplateStep[] = [
  {
    id: "evaluacion_inicial",
    title: "Evaluacion inicial",
    description: "Exploracion inicial del caso y necesidades principales.",
    fields: [
      field("motivo", "Motivo terapeutico"),
      field("hipotesis_inicial", "Hipotesis inicial")
    ]
  },
  {
    id: "objetivos",
    title: "Objetivos terapeuticos",
    fields: [
      field("objetivos", "Objetivos acordados"),
      field("indicadores", "Indicadores de avance")
    ]
  },
  {
    id: "intervencion",
    title: "Intervencion y seguimiento",
    fields: [
      field("linea_trabajo", "Linea de trabajo"),
      field("ajustes", "Ajustes clinicos")
    ]
  },
  commonClosureStep
];

export const PROCESS_DEFAULT_TEMPLATE_STEPS: Record<ProcessModelType, ProcessTemplateStep[]> = {
  general: DEFAULT_GENERAL_TEMPLATE_STEPS,
  tcc: [
    {
      id: "sesion_0_preparacion",
      title: "Sesion 0: Preparacion inicial",
      description: "Activacion del proceso, consentimiento informado e historia de vida.",
      fields: [
        field("hotlink_enviado", "Hotlink o acceso enviado al paciente", "checkbox"),
        field("consentimiento_revisado", "Consentimiento informado revisado", "checkbox"),
        field("historia_vida_activada", "Historia de vida activada para el paciente", "checkbox"),
        field("recordatorios", "Recordatorios o seguimiento previo por correo"),
        field("observaciones_preparacion", "Observaciones de preparacion")
      ]
    },
    {
      id: "sesiones_1_2_evaluacion",
      title: "Sesiones 1 y 2: Evaluacion",
      description: "Entrevista inicial, conceptualizacion y analisis de informacion base.",
      fields: [
        field("entrevista_inicial", "Formato de entrevista inicial revisado"),
        field("historia_vida_resultados", "Analisis de historia de vida y resultados de test"),
        field("conceptualizacion", "Conceptualizacion del caso"),
        field("diagnostico_dsm", "Analisis desde DSM / CIE si aplica"),
        field("objetivos_iniciales", "Objetivos iniciales del tratamiento"),
        field("resultado_evaluacion", "Resultado esperado de evaluacion inicial")
      ]
    },
    {
      id: "sesiones_3_7_intervencion_inicial",
      title: "Sesiones 3 a 7: Intervencion inicial",
      description: "Aplicacion del plan de tratamiento y notas de sesion.",
      fields: [
        field("plan_tratamiento_actual", "Plan de tratamiento actual"),
        field("intervenciones_aplicadas", "Intervenciones aplicadas"),
        field("notas_sesion", "Notas de sesion relevantes"),
        field("estado_animo_grafica", "Resumen de grafica de estado de animo"),
        field("ajustes_plan", "Ajustes al plan")
      ]
    },
    {
      id: "sesion_8_evaluacion",
      title: "Sesion 8: Evaluacion",
      description: "Primer corte de evaluacion y reenvio de pruebas.",
      fields: [
        field("primer_corte", "Primer corte de evaluacion"),
        field("tests_reenviados", "Tests reenviados al paciente"),
        field("analisis_formatos", "Analisis de formatos disponibles"),
        field("conceptualizacion_actualizada", "Conceptualizacion actualizada"),
        field("resultados_test", "Nuevos resultados de test"),
        field("programacion_siguientes", "Programacion de siguientes 8 sesiones")
      ]
    },
    {
      id: "sesiones_9_17_intervencion",
      title: "Sesiones 9 a 17: Intervencion",
      description: "Continuidad del tratamiento con seguimiento de estado de animo.",
      fields: [
        field("plan_actual", "Plan de sesion actual"),
        field("intervenciones_semana", "Intervenciones aplicadas"),
        field("resumen_estado_animo", "Resumen de grafica de estado de animo"),
        field("notas_sesion", "Notas de sesion"),
        field("proximo_corte", "Indicadores para proximo corte")
      ]
    },
    {
      id: "sesion_18_reevaluacion",
      title: "Sesion 18: Reevaluacion",
      description: "Segundo corte de evaluacion y comparacion con resultados iniciales.",
      fields: [
        field("segundo_corte", "Segundo corte de evaluacion"),
        field("tests_reaplicados", "Aplicacion nuevamente de test iniciales"),
        field("comparacion_resultados", "Comparacion de resultados"),
        field("conceptualizacion_final", "Conceptualizacion actualizada"),
        field("decision_continuidad", "Decision de continuidad, mantenimiento o cierre")
      ]
    },
    {
      ...commonClosureStep,
      id: "sesion_19_alta",
      title: "Sesion 19+: Alta del paciente",
      description: "Cierre clinico, plan de mantenimiento y alta."
    }
  ],
  gestalt: [
    {
      id: "awareness_contacto",
      title: "Awareness y ciclo de contacto",
      fields: [
        field("figura_fondo", "Figura/fondo emergente"),
        field("sensaciones_emociones", "Sensaciones, emociones y necesidades"),
        field("interrupciones_contacto", "Interrupciones del contacto"),
        field("asuntos_inconclusos", "Asuntos inconclusos")
      ]
    },
    {
      id: "experimentos",
      title: "Experimentos gestalticos",
      fields: [
        field("experimento", "Experimento propuesto"),
        field("vivencia", "Vivencia en sesion"),
        field("integracion", "Integracion de aprendizajes")
      ]
    },
    commonClosureStep
  ],
  third_wave: [
    {
      id: "analisis_contextual",
      title: "Analisis contextual y flexibilidad",
      fields: [
        field("conductas_contexto", "Conductas en contexto"),
        field("evitacion_experiencial", "Evitacion experiencial o fusion cognitiva"),
        field("mindfulness", "Practicas de atencion plena"),
        field("valores", "Valores y direccion vital")
      ]
    },
    {
      id: "habilidades_cambio",
      title: "Habilidades de aceptacion y cambio",
      fields: [
        field("aceptacion", "Aceptacion o disposicion"),
        field("defusion", "Defusion o distancia cognitiva"),
        field("accion_comprometida", "Accion comprometida")
      ]
    },
    commonClosureStep
  ],
  psychodynamic: [
    {
      id: "formulacion_dinamica",
      title: "Formulacion psicodinamica",
      fields: [
        field("conflictos", "Conflictos nucleares"),
        field("defensas", "Defensas predominantes"),
        field("patrones_relacionales", "Patrones relacionales repetitivos"),
        field("transferencia", "Transferencia y contratransferencia")
      ]
    },
    {
      id: "trabajo_interpretativo",
      title: "Trabajo interpretativo",
      fields: [
        field("foco", "Foco terapeutico"),
        field("insights", "Insights emergentes"),
        field("elaboracion", "Elaboracion y cambios")
      ]
    },
    commonClosureStep
  ],
  humanistic: [
    {
      id: "experiencia_persona",
      title: "Experiencia y proceso de la persona",
      fields: [
        field("vivencia_actual", "Vivencia actual"),
        field("congruencia", "Congruencia/incongruencia"),
        field("recursos", "Recursos y fortalezas"),
        field("necesidades", "Necesidades y direccion de crecimiento")
      ]
    },
    {
      id: "relacion_terapeutica",
      title: "Relacion terapeutica",
      fields: [
        field("empatia", "Empatia y comprension"),
        field("aceptacion", "Aceptacion positiva incondicional"),
        field("autonomia", "Autonomia y eleccion")
      ]
    },
    commonClosureStep
  ],
  systemic: [
    {
      id: "mapa_sistemico",
      title: "Mapa sistemico y relacional",
      fields: [
        field("sistema_relevante", "Sistema o red relevante"),
        field("patrones_interaccion", "Patrones de interaccion"),
        field("circularidad", "Hipotesis circular"),
        field("genograma", "Genograma o patrones transgeneracionales")
      ]
    },
    {
      id: "intervencion_sistemica",
      title: "Intervencion sistemica",
      fields: [
        field("reencuadre", "Reencuadre"),
        field("preguntas_circulares", "Preguntas circulares"),
        field("tareas_relacionales", "Tareas relacionales")
      ]
    },
    commonClosureStep
  ],
  brief_systemic: [
    {
      id: "problema_intentos",
      title: "Problema, intentos de solucion y excepciones",
      fields: [
        field("problema_actual", "Problema actual en terminos observables"),
        field("intentos_solucion", "Intentos de solucion que mantienen el problema"),
        field("excepciones", "Excepciones y recursos")
      ]
    },
    {
      id: "intervencion_breve",
      title: "Intervencion breve",
      fields: [
        field("objetivo_minimo", "Objetivo minimo de cambio"),
        field("prescripcion", "Prescripcion o tarea"),
        field("seguimiento_cambio", "Seguimiento del cambio")
      ]
    },
    commonClosureStep
  ],
  neuropsychological: [
    {
      id: "perfil_neuropsicologico",
      title: "Perfil neuropsicologico",
      fields: [
        field("motivo_evaluacion", "Motivo de evaluacion/intervencion"),
        field("dominios", "Dominios cognitivos afectados"),
        field("funcionalidad", "Impacto funcional"),
        field("factores_medicos", "Factores medicos o neurologicos relevantes")
      ]
    },
    {
      id: "rehabilitacion",
      title: "Plan de rehabilitacion o compensacion",
      fields: [
        field("objetivos_cognitivos", "Objetivos cognitivos"),
        field("estrategias", "Estrategias compensatorias"),
        field("familia_entorno", "Trabajo con familia/entorno"),
        field("medicion", "Medicion de progreso")
      ]
    },
    commonClosureStep
  ],
  gestalt_humanistic: [
    {
      id: "vivencia_contacto",
      title: "Vivencia, contacto y crecimiento",
      fields: [
        field("experiencia_presente", "Experiencia presente"),
        field("necesidades", "Necesidades organismicas"),
        field("bloqueos", "Bloqueos o interrupciones"),
        field("potencial", "Potencial de crecimiento")
      ]
    },
    {
      id: "experimentos_relacion",
      title: "Experimentos y relacion terapeutica",
      fields: [
        field("experimentos", "Experimentos vivenciales"),
        field("autenticidad", "Autenticidad y congruencia"),
        field("integracion", "Integracion")
      ]
    },
    commonClosureStep
  ],
  rebt: [
    {
      id: "abc",
      title: "Modelo ABC/ABCDE",
      fields: [
        field("a_activador", "A - Acontecimiento activador"),
        field("b_creencias", "B - Creencias irracionales/racionales"),
        field("c_consecuencias", "C - Consecuencias emocionales y conductuales"),
        field("d_disputa", "D - Disputa de creencias"),
        field("e_nueva_creencia", "E - Nueva creencia efectiva")
      ]
    },
    {
      id: "practica",
      title: "Practica y tareas REBT",
      fields: [
        field("autoaceptacion", "Autoaceptacion/aceptacion de otros/vida"),
        field("ejercicios", "Ejercicios emotivos o conductuales"),
        field("tareas", "Tareas para casa")
      ]
    },
    commonClosureStep
  ],
  emdr: [
    {
      id: "preparacion",
      title: "Historia, preparacion y recursos",
      fields: [
        field("historia_trauma", "Historia y eventos blanco"),
        field("estabilizacion", "Estabilizacion y recursos"),
        field("plan_blancos", "Plan de blancos EMDR")
      ]
    },
    {
      id: "procesamiento",
      title: "Procesamiento EMDR",
      fields: [
        field("imagen_blanco", "Imagen/recuerdo blanco"),
        field("creencia_negativa", "Creencia negativa"),
        field("creencia_positiva", "Creencia positiva"),
        field("emociones_sud", "Emociones y SUD"),
        field("sensaciones", "Sensaciones corporales"),
        field("desensibilizacion", "Desensibilizacion, instalacion y escaneo corporal")
      ]
    },
    commonClosureStep
  ],
  psychological_consulting: [
    {
      id: "demanda_consultoria",
      title: "Demanda y encuadre de consultoria",
      fields: [
        field("demanda", "Demanda principal"),
        field("alcance", "Alcance y limites de la consultoria"),
        field("recursos", "Recursos disponibles"),
        field("indicadores", "Indicadores de resultado")
      ]
    },
    {
      id: "plan_accion",
      title: "Plan de accion",
      fields: [
        field("recomendaciones", "Recomendaciones"),
        field("acciones", "Acciones acordadas"),
        field("seguimiento", "Seguimiento")
      ]
    },
    commonClosureStep
  ],
  schema_therapy: [
    {
      id: "esquemas_modos",
      title: "Esquemas, necesidades y modos",
      fields: [
        field("esquemas", "Esquemas tempranos desadaptativos"),
        field("necesidades", "Necesidades emocionales no cubiertas"),
        field("modos", "Modos de esquema activados"),
        field("estilos_afrontamiento", "Estilos de afrontamiento")
      ]
    },
    {
      id: "intervencion_esquemas",
      title: "Intervencion de esquemas",
      fields: [
        field("reparentalizacion", "Reparentalizacion limitada"),
        field("tecnicas_experienciales", "Tecnicas experienciales"),
        field("cambio_patrones", "Cambio de patrones conductuales")
      ]
    },
    commonClosureStep
  ],
  dbt: [
    {
      id: "jerarquia_objetivos",
      title: "Jerarquia de objetivos DBT",
      fields: [
        field("riesgo_vida", "Conductas que amenazan la vida"),
        field("interferencia_terapia", "Conductas que interfieren con terapia"),
        field("calidad_vida", "Conductas que afectan calidad de vida")
      ]
    },
    {
      id: "habilidades_dbt",
      title: "Habilidades DBT",
      fields: [
        field("mindfulness", "Mindfulness"),
        field("regulacion_emocional", "Regulacion emocional"),
        field("tolerancia_malestar", "Tolerancia al malestar"),
        field("efectividad_interpersonal", "Efectividad interpersonal"),
        field("analisis_cadena", "Analisis en cadena y solucion")
      ]
    },
    commonClosureStep
  ],
  act: [
    {
      id: "flexibilidad_psicologica",
      title: "Flexibilidad psicologica",
      fields: [
        field("evitacion_fusion", "Evitacion experiencial y fusion cognitiva"),
        field("aceptacion", "Aceptacion"),
        field("defusion", "Defusion"),
        field("presente", "Contacto con el presente"),
        field("yo_contexto", "Yo como contexto"),
        field("valores", "Valores")
      ]
    },
    {
      id: "accion_comprometida",
      title: "Accion comprometida",
      fields: [
        field("metas", "Metas alineadas a valores"),
        field("barreras", "Barreras y disposicion"),
        field("acciones", "Acciones comprometidas")
      ]
    },
    commonClosureStep
  ],
  sfbt: [
    {
      id: "futuro_preferido",
      title: "Futuro preferido y excepciones",
      fields: [
        field("objetivo", "Objetivo concreto"),
        field("pregunta_milagro", "Pregunta milagro / futuro preferido"),
        field("excepciones", "Excepciones"),
        field("escala", "Escala de avance", "number")
      ]
    },
    {
      id: "soluciones",
      title: "Construccion de soluciones",
      fields: [
        field("recursos", "Recursos y fortalezas"),
        field("pasos", "Pequenos pasos acordados"),
        field("tareas", "Tareas de observacion o accion")
      ]
    },
    commonClosureStep
  ],
  mbct: [
    {
      id: "mindfulness_cognicion",
      title: "Mindfulness y patrones cognitivos",
      fields: [
        field("piloto_automatico", "Piloto automatico"),
        field("pensamientos_emociones", "Pensamientos, emociones y sensaciones"),
        field("reactividad", "Reactividad o rumiacion"),
        field("practicas", "Practicas mindfulness")
      ]
    },
    {
      id: "prevencion_recaidas",
      title: "Prevencion de recaidas",
      fields: [
        field("senales_tempranas", "Senales tempranas"),
        field("plan_respuesta", "Plan de respuesta consciente"),
        field("actividades_cuidado", "Actividades de cuidado y dominio")
      ]
    },
    commonClosureStep
  ],
  logotherapy: [
    {
      id: "sentido_valores",
      title: "Sentido, valores y responsabilidad",
      fields: [
        field("vacio_existencial", "Vacio existencial o sufrimiento"),
        field("valores_creativos", "Valores creativos"),
        field("valores_vivenciales", "Valores vivenciales"),
        field("valores_actitudinales", "Valores actitudinales"),
        field("responsabilidad", "Responsabilidad y eleccion")
      ]
    },
    {
      id: "intervencion_logoterapia",
      title: "Intervencion logoterapeutica",
      fields: [
        field("dialogo_socratico", "Dialogo socratico"),
        field("dereflexion", "Dereflexion"),
        field("intencion_paradojica", "Intencion paradojica")
      ]
    },
    commonClosureStep
  ],
  narrative: [
    {
      id: "historia_dominante",
      title: "Historia dominante y externalizacion",
      fields: [
        field("problema_externalizado", "Problema externalizado"),
        field("efectos_problema", "Efectos del problema"),
        field("historia_dominante", "Historia dominante")
      ]
    },
    {
      id: "reauthoring",
      title: "Re-autoria e historias preferidas",
      fields: [
        field("resultados_unicos", "Resultados unicos"),
        field("valores", "Valores y compromisos"),
        field("testigos", "Testigos o red de apoyo"),
        field("nueva_historia", "Nueva historia preferida")
      ]
    },
    commonClosureStep
  ],
  gottman: [
    {
      id: "evaluacion_pareja",
      title: "Evaluacion de pareja Metodo Gottman",
      fields: [
        field("mapas_amor", "Mapas del amor"),
        field("admiracion_afecto", "Admiracion y afecto"),
        field("girar_hacia", "Girar hacia en lugar de alejarse"),
        field("conflictos", "Conflictos solubles y perpetuos"),
        field("cuatro_jinetes", "Cuatro jinetes observados")
      ]
    },
    {
      id: "intervenciones_pareja",
      title: "Intervenciones de pareja",
      fields: [
        field("manejo_conflicto", "Manejo de conflicto y reparacion"),
        field("aceptar_influencia", "Aceptar influencia y compromiso"),
        field("significado_compartido", "Significado compartido"),
        field("tareas_pareja", "Tareas de pareja")
      ]
    },
    commonClosureStep
  ]
};

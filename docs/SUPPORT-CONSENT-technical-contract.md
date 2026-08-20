# Centro de atencion y politica de consentimiento

## Alcance

- Canal bidireccional paciente-administracion.
- Canal bidireccional profesional-administracion.
- Mensajes operativos sin contenido clinico.
- Operaciones administrativas auditadas: citas, contrasena, canalizacion y avisos.
- Una sesion inicial de gracia mientras el consentimiento sigue pendiente.
- Bloqueo de nuevas sesiones, notas, evaluaciones y avance del proceso despues de la gracia.
- Recordatorios automaticos de consentimiento por correo.

## Separacion de datos

Las tablas `support_conversations` y `support_messages` no contienen referencias a notas,
evaluaciones ni contenido del expediente. Los administradores pueden ver identidad, citas y mensajes
operativos, pero las pantallas del centro no consultan contenido clinico.

Los mensajes son append-only. `authenticated` no tiene permisos de UPDATE ni DELETE sobre ellos.
El RLS limita a cada participante a su propia conversacion y permite acceso administrativo a los
roles `administrador` y `super_administrador`.

## Sesion de gracia

Estados que habilitan operacion normal:

- `firmado_fisico`
- `firmado_digital`
- `excepcion_justificada`

Mientras el consentimiento esta pendiente:

1. Puede programarse una primera cita no cancelada.
2. Puede crearse una primera nota clinica no addendum.
3. La primera nota consume la sesion de gracia.
4. Despues se bloquean nuevas citas, notas, evaluaciones y cambios en pasos del proceso.

La regla existe en Server Actions para ofrecer mensajes claros y en triggers PostgreSQL para evitar
saltos por llamadas directas o condiciones de carrera.

## Recordatorios automaticos

Configurar `CONSENT_REMINDER_CRON_SECRET` con un valor aleatorio largo y ejecutar diariamente:

```text
GET /api/cron/consent-reminders
Authorization: Bearer <CONSENT_REMINDER_CRON_SECRET>
```

El endpoint envia, como maximo una vez por etapa:

- recordatorio despues de 24 horas;
- recordatorio despues de 72 horas;
- aviso de bloqueo cuando se uso la sesion de gracia.

Los intentos se guardan en `consent_reminders`; los fallos no consumen la etapa y pueden reintentarse.
Cada ejecucion escribe auditoria sin contenido clinico.

## Operaciones administrativas

El centro administrativo permite:

- responder conversaciones;
- cambiar el estado del canal;
- programar o cancelar citas;
- enviar enlace seguro de cambio de contrasena;
- recordar la firma del consentimiento;
- enviar avisos legales u operativos sin adjuntos privados;
- registrar canalizaciones operativas.

Las integraciones personales de Google Calendar y Zoom no se ejecutan en nombre del profesional
cuando la cita la crea o cancela un administrador. La interfaz informa que deben revisarse.


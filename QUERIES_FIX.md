# QUERIES_FIX.md — Corrección de Cuestionarios Duplicados en Producción

## Problema

La tabla `questionnaires` no tenía un constraint `UNIQUE` sobre `(course_participant_id, type)`, lo que permitió que se generaran **múltiples cuestionarios del mismo tipo para el mismo participante**. Esto causaba que el frontend siempre mostrara el cuestionario como **Pendiente**, aunque el empleado ya lo hubiera completado.

---

## Paso 1 — Diagnóstico (solo lectura, sin riesgo)

Antes de modificar nada, verifica cuántos duplicados existen:

```sql
SELECT
  course_participant_id,
  type,
  COUNT(*) AS total,
  array_agg(id ORDER BY submitted_at DESC NULLS LAST, created_at DESC) AS ids,
  array_agg(status ORDER BY submitted_at DESC NULLS LAST, created_at DESC) AS statuses
FROM questionnaires
GROUP BY course_participant_id, type
HAVING COUNT(*) > 1
ORDER BY total DESC;
```

---

## Paso 2 — Eliminar duplicados (conserva el completado o el más reciente)

> [!CAUTION]
> Este paso **borra** filas de la base de datos. Haz un backup antes de ejecutarlo en producción.

El siguiente query elimina las respuestas y cuestionarios duplicados, conservando siempre el cuestionario con mayor prioridad: primero los `completed`, luego el más reciente por `submitted_at` y `created_at`.

```sql
-- 1. Eliminar respuestas de cuestionarios duplicados (todos excepto el primero por prioridad)
DELETE FROM questionnaire_responses
WHERE questionnaire_id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY course_participant_id, type
        ORDER BY
          CASE WHEN submitted_at IS NOT NULL THEN 0 ELSE 1 END ASC,
          submitted_at DESC NULLS LAST,
          created_at DESC
      ) AS rn
    FROM questionnaires
  ) ranked
  WHERE rn > 1
);

-- 2. Eliminar los cuestionarios duplicados
DELETE FROM questionnaires
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY course_participant_id, type
        ORDER BY
          CASE WHEN submitted_at IS NOT NULL THEN 0 ELSE 1 END ASC,
          submitted_at DESC NULLS LAST,
          created_at DESC
      ) AS rn
    FROM questionnaires
  ) ranked
  WHERE rn > 1
);
```

---

## Paso 3 — Agregar el UNIQUE constraint (previene futuros duplicados)

> [!IMPORTANT]
> Este paso fallará si aún quedan duplicados. Asegúrate de que el **Paso 2** se ejecutó correctamente primero.

```sql
ALTER TABLE questionnaires
ADD CONSTRAINT questionnaires_participant_type_unique
UNIQUE (course_participant_id, type);
```

---

## Paso 4 — Verificación final

Confirma que no quedan duplicados y que el constraint existe:

```sql
-- Debe retornar 0 filas si todo está limpio
SELECT course_participant_id, type, COUNT(*)
FROM questionnaires
GROUP BY course_participant_id, type
HAVING COUNT(*) > 1;

-- Verifica que el constraint fue creado
SELECT conname, contype
FROM pg_constraint
WHERE conname = 'questionnaires_participant_type_unique';
```

---

## Resumen de cambios en el código (ya aplicados en dev)

| Archivo | Cambio |
|---|---|
| `app/course/[id]/data/route.ts` | `jsonb_agg` ahora ordena por `submitted_at DESC NULLS LAST` → siempre muestra el cuestionario completado |
| `app/api/course-participants/route.ts` | INSERT usa `ON CONFLICT (course_participant_id, type) DO NOTHING` → no crea duplicados |

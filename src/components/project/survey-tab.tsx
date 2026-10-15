"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { FormSection } from "@/components/form-section";
import { FileUpload } from "@/components/project/file-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { surveySchema } from "@/shared/schemas/survey";

export type SurveyDetail = {
  id: string;
  surveyDate: string;
  surveyorNames: string;
  existingCondition: string;
  recommendation: string | null;
  latitude: string | null;
  longitude: string | null;
  notes: string | null;
  version: number;
  files: {
    photos: { id: string; originalName: string }[];
    documents: { id: string; originalName: string }[];
    spatial: { id: string; originalName: string }[];
  };
};

const surveyFormSchema = surveySchema.omit({
  photoFileIds: true,
  documentFileIds: true,
  spatialFileIds: true,
});

type Props = {
  projectId: string;
  survey: SurveyDetail | null;
  locked: boolean;
};

export function SurveyTab({ projectId, survey, locked }: Props) {
  const router = useRouter();
  const [photos, setPhotos] = useState(survey?.files.photos ?? []);
  const [documents, setDocuments] = useState(survey?.files.documents ?? []);
  const [spatial, setSpatial] = useState(survey?.files.spatial ?? []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(surveyFormSchema),
    defaultValues: {
      version: survey?.version ?? 1,
      surveyDate: survey?.surveyDate ?? "",
      surveyorNames: survey?.surveyorNames ?? "",
      existingCondition: survey?.existingCondition ?? "",
      recommendation: survey?.recommendation ?? "",
      latitude: survey?.latitude ?? "",
      longitude: survey?.longitude ?? "",
      notes: survey?.notes ?? "",
    },
  });

  async function submit(values: z.infer<typeof surveyFormSchema>) {
    const response = await fetch(`/api/projects/${projectId}/survey`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...values,
        photoFileIds: photos.map((file) => file.id),
        documentFileIds: documents.map((file) => file.id),
        spatialFileIds: spatial.map((file) => file.id),
      }),
    });
    const body = (await response.json()) as { error?: { message?: string } };
    if (!response.ok) {
      toast.error(body.error?.message ?? "Survei gagal disimpan.");
      return;
    }
    toast.success("Survei disimpan");
    router.refresh();
  }

  if (locked) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">
          Survei terkunci karena AFCE sudah diajukan. Isian hanya dapat dibaca.
        </p>
        {survey ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink-muted">Tanggal survei</dt>
              <dd>{survey.surveyDate}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Surveyor</dt>
              <dd>{survey.surveyorNames}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-ink-muted">Kondisi eksisting</dt>
              <dd>{survey.existingCondition}</dd>
            </div>
          </dl>
        ) : null}
      </div>
    );
  }

  return (
    <form className="max-w-[720px]" noValidate onSubmit={handleSubmit(submit)}>
      <FormSection title="Data survei">
        <Field label="Tanggal survei" error={errors.surveyDate?.message}>
          <Input
            type="date"
            {...register("surveyDate")}
            aria-invalid={Boolean(errors.surveyDate)}
          />
        </Field>
        <Field label="Nama surveyor" error={errors.surveyorNames?.message}>
          <Input
            {...register("surveyorNames")}
            aria-invalid={Boolean(errors.surveyorNames)}
          />
        </Field>
        <Field
          label="Kondisi eksisting"
          error={errors.existingCondition?.message}
        >
          <textarea
            rows={3}
            {...register("existingCondition")}
            className="w-full rounded border bg-panel px-3 py-2 text-sm"
            aria-invalid={Boolean(errors.existingCondition)}
          />
        </Field>
        <Field label="Rekomendasi">
          <textarea
            rows={3}
            {...register("recommendation")}
            className="w-full rounded border bg-panel px-3 py-2 text-sm"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Latitude" error={errors.latitude?.message}>
            <Input inputMode="decimal" {...register("latitude")} />
          </Field>
          <Field label="Longitude" error={errors.longitude?.message}>
            <Input inputMode="decimal" {...register("longitude")} />
          </Field>
        </div>
        <Field label="Catatan">
          <textarea
            rows={2}
            {...register("notes")}
            className="w-full rounded border bg-panel px-3 py-2 text-sm"
          />
        </Field>
      </FormSection>

      <FormSection title="Lampiran">
        <FileUpload
          projectId={projectId}
          ownerType="Survey"
          ownerId={survey?.id ?? "baru"}
          kind="PROGRESS_PHOTO"
          label="Foto kondisi (maks. 5 MB)"
          files={photos}
          onChange={setPhotos}
        />
        <FileUpload
          projectId={projectId}
          ownerType="Survey"
          ownerId={survey?.id ?? "baru"}
          kind="DOCUMENT"
          label="Dokumen (maks. 10 MB)"
          files={documents}
          onChange={setDocuments}
        />
        <FileUpload
          projectId={projectId}
          ownerType="Survey"
          ownerId={survey?.id ?? "baru"}
          kind="SPATIAL_DATA"
          label="Data spasial .zip atau .geojson (maks. 10 MB)"
          files={spatial}
          onChange={setSpatial}
        />
      </FormSection>

      <div className="mt-6">
        <Button type="submit" disabled={isSubmitting}>
          Simpan survei
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

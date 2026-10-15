"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { FormSection } from "@/components/form-section";
import { PageHeader } from "@/components/page-header";
import { EstatePicker } from "@/components/project/estate-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createProjectSchema } from "@/shared/schemas/project";

export type FormOption = { id: string; name: string };

export type FormEstate = {
  id: string;
  code: string;
  name: string;
  regionId: string;
  blocks: { id: string; blockCode: string; name: string }[];
};

export type FormCompany = {
  id: string;
  code: string;
  name: string;
  estates: FormEstate[];
};

const projectFormSchema = createProjectSchema.extend({
  regionId: z.string().min(1, "Pilih Region."),
  primaryEstateId: z.string().min(1, "Pilih Estate utama."),
  estates: z
    .array(z.object({ estateId: z.string().min(1), blockId: z.string() }))
    .min(1, "Pilih minimal satu Estate."),
});

type FormValues = z.infer<typeof projectFormSchema>;

type Props = {
  regions: (FormOption & { code: string })[];
  companies: FormCompany[];
  categories: FormOption[];
  pics: FormOption[];
};

export function ProjectForm({ regions, companies, categories, pics }: Props) {
  const router = useRouter();

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: "",
      categoryId: "",
      regionId: "",
      companyId: "",
      description: "",
      picUserId: "",
      targetStartDate: "",
      targetEndDate: "",
      plannedBudget: "",
      primaryEstateId: "",
      estates: [],
    },
  });

  const estateArray = useFieldArray({ control, name: "estates" });
  const regionId = watch("regionId");
  const companyId = watch("companyId");
  const primaryEstateId = watch("primaryEstateId");

  const companiesInRegion = useMemo(
    () =>
      companies.filter((company) =>
        company.estates.some((estate) => estate.regionId === regionId),
      ),
    [companies, regionId],
  );
  const estates = useMemo(
    () => companies.find((company) => company.id === companyId)?.estates ?? [],
    [companies, companyId],
  );

  async function submit(values: FormValues) {
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: values.name,
        companyId: values.companyId,
        categoryId: values.categoryId,
        description: values.description || null,
        picUserId: values.picUserId || null,
        targetStartDate: values.targetStartDate || null,
        targetEndDate: values.targetEndDate || null,
        plannedBudget: values.plannedBudget || null,
        estates: values.estates.map((estate) => ({
          estateId: estate.estateId,
          blockId: estate.blockId || null,
          isPrimary: estate.estateId === values.primaryEstateId,
        })),
      }),
    });
    const body = (await response.json()) as {
      data?: { code: string };
      error?: { message?: string };
    };
    if (!response.ok || !body.data) {
      toast.error(body.error?.message ?? "Proyek gagal disimpan.");
      return;
    }
    toast.success("Proyek dibuat");
    router.push(`/proyek/${body.data.code}`);
  }

  return (
    <>
      <PageHeader
        title="Buat proyek"
        description="Kode proyek dibuat otomatis setelah disimpan."
      />
      <form
        className="max-w-[720px]"
        noValidate
        onSubmit={handleSubmit(submit)}
      >
        <FormSection title="Data dasar">
          <Field label="Nama proyek" error={errors.name?.message}>
            <Input {...register("name")} aria-invalid={Boolean(errors.name)} />
          </Field>
          <Field label="Kategori" error={errors.categoryId?.message}>
            <select
              {...register("categoryId")}
              className="h-9 w-full rounded border bg-panel px-2 text-sm"
              aria-invalid={Boolean(errors.categoryId)}
            >
              <option value="">Pilih kategori</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="PIC">
            <select
              {...register("picUserId")}
              className="h-9 w-full rounded border bg-panel px-2 text-sm"
            >
              <option value="">Pilih PIC</option>
              {pics.map((pic) => (
                <option key={pic.id} value={pic.id}>
                  {pic.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Deskripsi">
            <textarea
              {...register("description")}
              rows={3}
              className="w-full rounded border bg-panel px-3 py-2 text-sm"
            />
          </Field>
        </FormSection>

        <FormSection title="Lokasi">
          <Field label="Region" error={errors.regionId?.message}>
            <select
              {...register("regionId")}
              className="h-9 w-full rounded border bg-panel px-2 text-sm"
              aria-invalid={Boolean(errors.regionId)}
            >
              <option value="">Pilih Region</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Company" error={errors.companyId?.message}>
            <select
              {...register("companyId")}
              className="h-9 w-full rounded border bg-panel px-2 text-sm"
              aria-invalid={Boolean(errors.companyId)}
            >
              <option value="">Pilih Company</option>
              {companiesInRegion.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </Field>
          <EstatePicker
            estates={estates}
            selection={watch("estates").map((row, index) => ({
              id: estateArray.fields[index]?.id ?? `${row.estateId}-${index}`,
              estateId: row.estateId,
              blockId: row.blockId,
            }))}
            primaryEstateId={primaryEstateId}
            onToggle={(estateId, checked) => {
              if (checked) {
                estateArray.append({ estateId, blockId: "" });
                return;
              }
              const index = estateArray.fields.findIndex(
                (field) => field.estateId === estateId,
              );
              if (index >= 0) estateArray.remove(index);
              if (primaryEstateId === estateId) {
                setValue("primaryEstateId", "");
              }
            }}
            onBlockChange={(index, blockId) =>
              setValue(`estates.${index}.blockId`, blockId)
            }
            onPrimaryChange={(estateId) =>
              setValue("primaryEstateId", estateId)
            }
            error={errors.estates?.message}
            primaryError={errors.primaryEstateId?.message}
          />
        </FormSection>

        <FormSection title="Target dan anggaran">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Target mulai" error={errors.targetStartDate?.message}>
              <Input
                type="date"
                {...register("targetStartDate")}
                aria-invalid={Boolean(errors.targetStartDate)}
              />
            </Field>
            <Field label="Target selesai" error={errors.targetEndDate?.message}>
              <Input
                type="date"
                {...register("targetEndDate")}
                aria-invalid={Boolean(errors.targetEndDate)}
              />
            </Field>
          </div>
          <Field
            label="Anggaran rencana"
            hint="boleh dikosongkan, tetapi wajib sebelum Mulai Survei"
            error={errors.plannedBudget?.message}
          >
            <Input
              inputMode="decimal"
              placeholder="450000000.00"
              {...register("plannedBudget")}
              aria-invalid={Boolean(errors.plannedBudget)}
            />
          </Field>
        </FormSection>

        <div className="mt-6 flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            Simpan proyek
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Batal
          </Button>
        </div>
      </form>
    </>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-ink-muted">{hint}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
